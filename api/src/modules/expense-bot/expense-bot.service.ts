import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../infra/config/env.types';
import { BotApi, type BotMessageRef, type Keyboard } from '../../integrations/telegram';
import { GoogleService } from '../../integrations/google';
import { SecurityLogService } from '../security-log';
import {
  LedgerService,
  type ExpenseField,
  type ExpenseFileKind,
  type ExpenseInput,
  type StoredExpense,
} from '../ledger';

export interface BotCallback {
  id: string;
  from: { id: number };
  data?: string;
  message?: BotMessageRef;
}

export interface BotFile {
  fileId: string;
  name?: string;
  mime?: string;
}

type FileStep = 'receipts' | 'photos';
type Step = ExpenseField | FileStep | 'newPerson' | 'confirm';

interface PendingFile extends BotFile {
  kind: ExpenseFileKind;
}

interface Draft {
  mode: 'add' | 'edit';
  step: Step;
  data: Partial<ExpenseInput>;
  files: PendingFile[];
  id?: number;
}

const MAX_FILES: Record<FileStep, number> = { receipts: 3, photos: 10 };
const FILE_KIND: Record<FileStep, ExpenseFileKind> = { receipts: 'receipt', photos: 'photo' };

const ADD_STEPS: Step[] = [
  'date', 'item', 'itemEn', 'description', 'category', 'person',
  'price', 'delivery', 'commission', 'note', 'hasReceipt', 'receipts', 'photos',
];

const LABEL: Record<ExpenseField | FileStep, string> = {
  date: 'Дата',
  item: 'Назва',
  itemEn: 'Назва англійською',
  description: 'Опис',
  category: 'Категорія',
  person: 'Кому',
  price: 'Ціна',
  delivery: 'Доставка',
  commission: 'Комісія',
  hasReceipt: 'Чек є/немає',
  note: 'Примітка',
  receipts: '+ Чеки',
  photos: '+ Фото звіт',
};

const HELP =
  'Команди:\n' +
  '/add — додати витрату\n' +
  '/edit — змінити витрату\n' +
  '/delete — видалити витрату\n' +
  '/last — 10 останніх витрат\n' +
  '/sync 23 — повторно записати витрату 23 у Google Таблицю\n' +
  '/cancel — скасувати поточну дію';

const kyivDate = (daysAgo = 0) =>
  new Date(Date.now() - daysAgo * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });

export function parseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s === 'today' || s === 'сьогодні') return kyivDate();
  if (s === 'yesterday' || s === 'вчора') return kyivDate(1);
  let y: string, m: string, d: string;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/.exec(s);
  if (iso) [, y, m, d] = iso as unknown as [string, string, string, string];
  else if (dmy) {
    [, d, m] = dmy as unknown as [string, string, string];
    const year = dmy[3] ?? kyivDate().slice(0, 4);
    y = year.length === 2 ? `20${year}` : year;
  } else return null;
  const value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null;
}
const money = (n: number) => `${n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const short = (e: StoredExpense) => `${e.date.slice(8, 10)}.${e.date.slice(5, 7)} · ${e.item} · ${money(e.total)}`;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

@Injectable()
export class ExpenseBotService {
  private readonly logger = new Logger(ExpenseBotService.name);
  private readonly drafts = new Map<number, Draft>();

  constructor(
    private readonly bot: BotApi,
    private readonly ledger: LedgerService,
    private readonly google: GoogleService,
    private readonly securityLog: SecurityLogService,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  private isAdmin(telegramId: number): boolean {
    return this.config.get('ADMIN_TELEGRAM_IDS', { infer: true }).includes(telegramId);
  }

  async handleMessage(telegramId: number, chatId: number, text: string): Promise<boolean> {
    if (text === '/id') {
      await this.bot.send(chatId, `Ваш Telegram ID: ${telegramId}`);
      return true;
    }
    if (!this.isAdmin(telegramId)) return false;

    const [, command, arg] = /^\/(\w+)(?:@\w+)?\s*(.*)$/.exec(text) ?? [];
    if (command && command !== 'start') {
      this.drafts.delete(telegramId);
      switch (command) {
        case 'add':
          this.drafts.set(telegramId, { mode: 'add', step: 'date', data: {}, files: [] });
          await this.ask(chatId, telegramId);
          return true;
        case 'edit':
          await this.pickExpense(chatId, 'e', 'Яку витрату змінити?');
          return true;
        case 'delete':
          await this.pickExpense(chatId, 'd', 'Яку витрату видалити?');
          return true;
        case 'last':
          await this.showLast(chatId);
          return true;
        case 'sync':
          await this.resync(chatId, Number(arg));
          return true;
        case 'cancel':
          await this.bot.send(chatId, 'Скасовано.');
          return true;
        default:
          await this.bot.send(chatId, HELP);
          return true;
      }
    }

    const draft = this.drafts.get(telegramId);
    if (!draft || draft.step === 'confirm' || draft.step === 'receipts' || draft.step === 'photos') return false;
    await this.accept(chatId, telegramId, draft, text);
    return true;
  }

  async handleFile(telegramId: number, chatId: number, file: BotFile): Promise<boolean> {
    if (!this.isAdmin(telegramId)) return false;
    const draft = this.drafts.get(telegramId);
    if (!draft || (draft.step !== 'receipts' && draft.step !== 'photos')) {
      await this.bot.send(chatId, 'Файл зараз не очікується. Почніть з /add або /edit.');
      return true;
    }
    const step = draft.step;
    const kind = FILE_KIND[step];
    const already = this.existingCount(draft, kind);
    const max = MAX_FILES[step];
    if (already >= max) {
      await this.bot.send(chatId, `Уже ${max} — більше не можна.`);
      return true;
    }
    draft.files.push({ ...file, kind });
    const count = already + 1;
    if (count >= max) {
      await this.bot.send(chatId, `Отримано ${count} з ${max}.`);
      await this.finishFiles(chatId, telegramId, draft);
    } else {
      await this.bot.send(chatId, `Отримано ${count} з ${max}. Надішліть ще або натисніть «Готово».`, [
        [{ text: 'Готово', callback_data: 'x:v:done' }],
      ]);
    }
    return true;
  }

  async handleCallback(query: BotCallback): Promise<boolean> {
    const data = query.data ?? '';
    if (!data.startsWith('x:') || !query.message) return false;
    await this.bot.answer(query.id);
    const telegramId = query.from.id;
    if (!this.isAdmin(telegramId)) return true;

    const chatId = query.message.chat.id;
    const [, action, arg = ''] = data.split(':');
    const draft = this.drafts.get(telegramId);

    switch (action) {
      case 'v':
        if (!draft || draft.step === 'confirm') return true;
        if (draft.step === 'receipts' || draft.step === 'photos') {
          await this.finishFiles(chatId, telegramId, draft);
        } else {
          await this.accept(chatId, telegramId, draft, arg, true);
        }
        return true;
      case 'ok':
        if (draft?.step === 'confirm') await this.save(chatId, telegramId, draft);
        return true;
      case 'no':
        this.drafts.delete(telegramId);
        await this.bot.edit(query.message, 'Скасовано.');
        return true;
      case 'e':
        await this.chooseField(query.message, Number(arg));
        return true;
      case 'f': {
        const [field, id] = arg.split('.') as [ExpenseField | FileStep, string];
        if (!(field in LABEL)) return true;
        this.drafts.set(telegramId, { mode: 'edit', step: field, data: {}, files: [], id: Number(id) });
        await this.ask(chatId, telegramId);
        return true;
      }
      case 'd':
        await this.confirmDelete(query.message, Number(arg));
        return true;
      case 'dd':
        await this.remove(query.message, telegramId, Number(arg));
        return true;
      default:
        return true;
    }
  }

  private existingCount(draft: Draft, kind: ExpenseFileKind): number {
    const saved = draft.id ? this.ledger.files(draft.id).filter((f) => f.kind === kind).length : 0;
    return saved + draft.files.filter((f) => f.kind === kind).length;
  }

  private async ask(chatId: number, telegramId: number): Promise<void> {
    const draft = this.drafts.get(telegramId)!;
    const skip = (text: string, value = '-') => [[{ text, callback_data: `x:v:${value}` }]];
    switch (draft.step) {
      case 'date':
        return void (await this.bot.send(chatId, 'Дата витрати: виберіть або напишіть, напр. 12.10.2026 чи 12.10', [
          [{ text: 'Сьогодні', callback_data: 'x:v:today' }, { text: 'Вчора', callback_data: 'x:v:yesterday' }],
        ]));
      case 'item':
        return void (await this.bot.send(chatId, 'На що витрата (видно всім на сайті), напр. «Ремонт машини»:'));
      case 'itemEn':
        return void (await this.bot.send(chatId, 'Назва англійською:', skip('Пропустити')));
      case 'description':
        return void (await this.bot.send(chatId, 'Опис: що саме, напр. «заміна зчеплення» (не видно на сайті):', skip('Пропустити')));
      case 'category':
        return void (await this.bot.send(
          chatId,
          'Категорія:',
          this.ledger.categories().map((name, i) => [{ text: name, callback_data: `x:v:${i}` }]),
        ));
      case 'person': {
        const people = this.ledger.people();
        const rows: Keyboard = [];
        for (let i = 0; i < people.length; i += 2) {
          rows.push(people.slice(i, i + 2).map((name, j) => ({ text: name, callback_data: `x:v:p${i + j}` })));
        }
        rows.push([{ text: '➕ Нова людина', callback_data: 'x:v:new' }]);
        rows.push([{ text: 'Без людини', callback_data: 'x:v:none' }]);
        return void (await this.bot.send(chatId, 'Кому була допомога:', rows));
      }
      case 'newPerson':
        return void (await this.bot.send(chatId, 'Ім\'я (так, як писатимете й надалі):'));
      case 'price':
        return void (await this.bot.send(chatId, 'Ціна, ₴:'));
      case 'delivery':
        return void (await this.bot.send(chatId, 'Доставка, ₴:', skip('0', '0')));
      case 'commission':
        return void (await this.bot.send(chatId, 'Комісія банку, ₴:', skip('0', '0')));
      case 'hasReceipt':
        return void (await this.bot.send(chatId, 'Чек є?', [
          [{ text: 'Є', callback_data: 'x:v:1' }, { text: 'Немає', callback_data: 'x:v:0' }],
        ]));
      case 'note':
        return void (await this.bot.send(chatId, 'Примітка (лише в закритому звіті), напр. «позика»:', skip('Без примітки')));
      case 'receipts':
        return void (await this.bot.send(
          chatId,
          'Надішліть чеки: оплата, доставка, інвойс — фото або PDF, до 3.',
          skip(draft.mode === 'add' ? 'Додам пізніше' : 'Готово', 'done'),
        ));
      case 'photos':
        return void (await this.bot.send(
          chatId,
          'Надішліть фото-звіт покупки, до 10 фото.',
          skip(draft.mode === 'add' ? 'Пропустити' : 'Готово', 'done'),
        ));
      case 'confirm':
        return void (await this.bot.send(chatId, this.summary(draft), [
          [{ text: '✅ Записати', callback_data: 'x:ok' }, { text: 'Скасувати', callback_data: 'x:no' }],
        ]));
    }
  }

  private async accept(chatId: number, telegramId: number, draft: Draft, raw: string, button = false): Promise<void> {
    const parsed = this.parse(draft.step as ExpenseField | 'newPerson', raw.trim(), button);
    if ('error' in parsed) {
      await this.bot.send(chatId, `⚠️ ${parsed.error}`);
      return this.ask(chatId, telegramId);
    }
    if ('next' in parsed) {
      draft.step = parsed.next;
      return this.ask(chatId, telegramId);
    }

    const field = draft.step === 'newPerson' ? 'person' : (draft.step as ExpenseField);
    (draft.data as Record<string, unknown>)[field] = parsed.value;

    if (draft.mode === 'edit') return this.saveEdit(chatId, telegramId, draft, field);
    return this.advance(chatId, telegramId, draft, field);
  }

  private async advance(chatId: number, telegramId: number, draft: Draft, current: Step): Promise<void> {
    const skip = (s: Step) =>
      (!this.google.enabled && (s === 'receipts' || s === 'photos')) || (s === 'receipts' && draft.data.hasReceipt === false);
    let next = ADD_STEPS.indexOf(current) + 1;
    while (ADD_STEPS[next] && skip(ADD_STEPS[next]!)) next += 1;
    draft.step = ADD_STEPS[next] ?? 'confirm';
    return this.ask(chatId, telegramId);
  }

  private async finishFiles(chatId: number, telegramId: number, draft: Draft): Promise<void> {
    const step = draft.step as FileStep;
    if (draft.mode === 'add') return this.advance(chatId, telegramId, draft, step);
    this.drafts.delete(telegramId);
    const e = this.ledger.get(draft.id!);
    if (!e) return void (await this.bot.send(chatId, 'Цієї витрати вже немає.'));
    if (draft.files.length === 0) return void (await this.bot.send(chatId, 'Нічого не додано.'));
    try {
      await this.uploadFiles(e.id, e, draft.files);
    } catch (error) {
      return void (await this.bot.send(chatId, `⚠️ Не вдалося завантажити файли: ${this.reason(error)}. Спробуйте ще раз.`));
    }
    this.securityLog.record('expense.edit', { admin: telegramId, id: e.id, field: step, added: draft.files.length });
    await this.bot.send(chatId, `✅ Додано файлів: ${draft.files.length}.\n${short(e)}`);
    await this.pushRow(chatId, e.id);
  }

  private parse(
    step: ExpenseField | 'newPerson',
    raw: string,
    button: boolean,
  ): { value: unknown } | { next: Step } | { error: string } {
    switch (step) {
      case 'date': {
        const value = parseDate(raw);
        return value ? { value } : { error: 'Не розумію дату. Напишіть, напр., 12.10.2026, 12.10 або 2026-10-12.' };
      }
      case 'item':
        return raw ? { value: raw } : { error: 'Назва не може бути порожньою.' };
      case 'itemEn':
      case 'description':
      case 'note':
        return { value: button && raw === '-' ? null : raw || null };
      case 'category': {
        const name = button ? this.ledger.categories()[Number(raw)] : raw;
        return name && this.ledger.categories().includes(name) ? { value: name } : { error: 'Виберіть категорію кнопкою.' };
      }
      case 'person': {
        if (!button) return { value: raw || null };
        if (raw === 'new') return { next: 'newPerson' };
        if (raw === 'none') return { value: null };
        const name = this.ledger.people()[Number(raw.slice(1))];
        return name ? { value: name } : { error: 'Виберіть людину кнопкою.' };
      }
      case 'newPerson': {
        if (!raw) return { error: 'Ім\'я не може бути порожнім.' };
        const existing = this.ledger.people().find((p) => p.toLowerCase() === raw.toLowerCase());
        return { value: existing ?? raw };
      }
      case 'price':
      case 'delivery':
      case 'commission': {
        const n = Number(raw.replace(',', '.').replace(/\s/g, ''));
        return raw !== '' && Number.isFinite(n) && n >= 0
          ? { value: Math.round(n * 100) / 100 }
          : { error: 'Потрібне число ≥ 0, напр. 5000 або 1234.50.' };
      }
      case 'hasReceipt':
        return raw === '1' || raw === '0' ? { value: raw === '1' } : { error: 'Виберіть кнопкою.' };
    }
  }

  private summary(draft: Draft): string {
    const e = draft.data as ExpenseInput;
    const total = e.price + e.delivery + e.commission;
    const count = (kind: ExpenseFileKind) => draft.files.filter((f) => f.kind === kind).length;
    return [
      'Перевірте:',
      `Дата: ${e.date}`,
      `Витрата: ${e.item}${e.itemEn ? ` / ${e.itemEn}` : ''}`,
      `Опис: ${e.description ?? '—'}`,
      `Категорія: ${e.category}`,
      `Кому: ${e.person ?? '— (без людини)'}`,
      `Сума: ${money(total)} (ціна ${e.price} + доставка ${e.delivery} + комісія ${e.commission})`,
      `Примітка: ${e.note ?? '—'}`,
      `Чек: ${e.hasReceipt ? `є (завантажено ${count('receipt')})` : 'немає'}`,
      `Фото звіт: ${count('photo')}`,
    ].join('\n');
  }

  private async save(chatId: number, telegramId: number, draft: Draft): Promise<void> {
    const data = {
      ...(draft.data as ExpenseInput),
      hasReceipt: draft.data.hasReceipt === true || draft.files.some((f) => f.kind === 'receipt'),
    };
    if (draft.files.length > 0) await this.bot.send(chatId, 'Завантажую файли…');

    let uploaded: Array<{ kind: ExpenseFileKind; name: string; url: string }> = [];
    try {
      uploaded = await this.prepareUploads(data, draft.files);
    } catch (error) {
      return void (await this.bot.send(chatId, `⚠️ Не вдалося завантажити файли: ${this.reason(error)}. Натисніть «Записати» ще раз.`, [
        [{ text: '✅ Записати', callback_data: 'x:ok' }, { text: 'Скасувати', callback_data: 'x:no' }],
      ]));
    }

    this.drafts.delete(telegramId);
    const id = this.ledger.addExpense(data, uploaded);
    this.securityLog.record('expense.add', { admin: telegramId, id, item: data.item, total: data.price + data.delivery + data.commission });
    await this.bot.send(chatId, `✅ Записано (id ${id}). На сайті вже видно.`);
    await this.pushRow(chatId, id);
  }

  private async uploadFiles(id: number, e: ExpenseInput, files: PendingFile[]): Promise<void> {
    const offset = { receipt: 0, photo: 0 };
    for (const f of this.ledger.files(id)) offset[f.kind] += 1;
    this.ledger.appendFiles(id, await this.prepareUploads(e, files, offset));
  }

  private async prepareUploads(
    e: ExpenseInput,
    files: PendingFile[],
    offset: Record<ExpenseFileKind, number> = { receipt: 0, photo: 0 },
  ): Promise<Array<{ kind: ExpenseFileKind; name: string; url: string }>> {
    if (files.length === 0) return [];
    if (!this.google.enabled) throw new Error('Google не налаштовано на сервері');
    const result: Array<{ kind: ExpenseFileKind; name: string; url: string }> = [];
    const counter = { ...offset };
    for (const f of files) {
      counter[f.kind] += 1;
      const { data, path } = await this.bot.download(f.fileId);
      const mime = f.mime ?? (path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const ext = f.name?.split('.').pop() ?? EXT[mime] ?? path.split('.').pop() ?? 'bin';
      const label = f.kind === 'receipt' ? 'чек' : 'фото';
      const name = safe(`${e.date} ${e.person ?? ''} ${e.item} (${label} ${counter[f.kind]})`) + `.${ext}`;
      const url = await this.google.upload(f.kind, e.date.slice(0, 4), name, mime, data);
      result.push({ kind: f.kind, name, url });
    }
    return result;
  }

  private async pushRow(chatId: number, id: number): Promise<void> {
    if (!this.google.enabled) return;
    const e = this.ledger.get(id);
    if (!e) return;
    try {
      const files = this.ledger.files(id);
      const urls = (kind: ExpenseFileKind) => files.filter((f) => f.kind === kind).map((f) => f.url).join('\n');
      await this.google.ensureHeader();
      await this.google.syncRow(id, [
        e.item, e.date, e.price, e.delivery, e.commission, e.hasReceipt ? 'так' : 'ні', e.total,
        e.person ?? '', e.category ?? '', e.description ?? '', e.note ?? '', urls('receipt'), urls('photo'), id,
      ]);
    } catch (error) {
      this.logger.warn(`sheet sync ${id} failed: ${this.reason(error)}`);
      await this.bot.send(chatId, `⚠️ У базі збережено, але Google Таблицю не оновлено: ${this.reason(error)}.\nПовторити: /sync ${id}`);
    }
  }

  private async resync(chatId: number, id: number): Promise<void> {
    if (!Number.isInteger(id) || !this.ledger.get(id)) return void (await this.bot.send(chatId, 'Вкажіть номер: /sync 23'));
    await this.pushRow(chatId, id);
    await this.bot.send(chatId, `Готово: ${short(this.ledger.get(id)!)}`);
  }

  private async saveEdit(chatId: number, telegramId: number, draft: Draft, field: ExpenseField): Promise<void> {
    this.drafts.delete(telegramId);
    const before = this.ledger.get(draft.id!);
    if (!before) return void (await this.bot.send(chatId, 'Цієї витрати вже немає.'));
    const value = draft.data[field] as ExpenseInput[typeof field];
    this.ledger.updateField(draft.id!, field, value);
    this.securityLog.record('expense.edit', { admin: telegramId, id: draft.id, field, from: before[field], to: value });
    await this.bot.send(chatId, `✅ ${LABEL[field]}: ${this.show(before[field])} → ${this.show(value)}\n${short(this.ledger.get(draft.id!)!)}`);
    await this.pushRow(chatId, draft.id!);
  }

  private show(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'є' : 'немає';
    return String(value);
  }

  private reason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async pickExpense(chatId: number, action: 'e' | 'd', title: string): Promise<void> {
    const recent = this.ledger.recent(10);
    if (recent.length === 0) return void (await this.bot.send(chatId, 'Витрат ще немає.'));
    await this.bot.send(chatId, title, recent.map((e) => [{ text: short(e), callback_data: `x:${action}:${e.id}` }]));
  }

  private async chooseField(message: BotMessageRef, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    const fields = (Object.keys(LABEL) as Array<ExpenseField | FileStep>).filter(
      (f) => this.google.enabled || (f !== 'receipts' && f !== 'photos'),
    );
    const rows: Keyboard = [];
    for (let i = 0; i < fields.length; i += 2) {
      rows.push(fields.slice(i, i + 2).map((f) => ({ text: LABEL[f], callback_data: `x:f:${f}.${id}` })));
    }
    await this.bot.edit(message, `${short(e)}\nЩо змінити?`, rows);
  }

  private async confirmDelete(message: BotMessageRef, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    await this.bot.edit(message, `Видалити?\n${short(e)}${e.person ? ` · ${e.person}` : ''}${this.ledger.files(id).length ? '\nЧеки й фото буде переміщено в кошик Google Диска.' : ''}`, [
      [{ text: '🗑 Видалити', callback_data: `x:dd:${id}` }, { text: 'Скасувати', callback_data: 'x:no' }],
    ]);
  }

  private async remove(message: BotMessageRef, telegramId: number, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    const files = this.ledger.files(id);
    this.ledger.removeExpense(id);
    this.securityLog.record('expense.delete', { admin: telegramId, id, item: e.item, total: e.total, files: files.length });
    await this.bot.edit(message, `🗑 Видалено: ${short(e)}`);
    if (!this.google.enabled) return;
    await this.google.deleteRow(id).catch(async (error) => {
      await this.bot.send(message.chat.id, `⚠️ Рядок у Google Таблиці не видалено: ${this.reason(error)}. Видаліть рядок з ID ${id} вручну.`);
    });
    const failed: string[] = [];
    for (const f of files) await this.google.trash(f.url).catch(() => failed.push(f.name));
    if (failed.length) {
      await this.bot.send(message.chat.id, `⚠️ Не вдалося перемістити в кошик: ${failed.join(', ')}. Видаліть їх на Диску вручну.`);
    }
  }

  private async showLast(chatId: number): Promise<void> {
    const recent = this.ledger.recent(10);
    await this.bot.send(
      chatId,
      recent.length
        ? recent.map((e) => `${e.id}. ${short(e)}${e.person ? ` · ${e.person}` : ''}`).join('\n')
        : 'Витрат ще немає.',
    );
  }
}
