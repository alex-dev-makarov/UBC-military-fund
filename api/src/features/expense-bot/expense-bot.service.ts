import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { BotApi, type BotMessageRef, type Keyboard } from '../../shared/telegram';
import { DatabaseService } from '../../shared/db';
import { SecurityLogService } from '../../shared/log';
import { LedgerRepository, type ExpenseField, type ExpenseInput, type StoredExpense } from '../../entities/report';

export interface BotCallback {
  id: string;
  from: { id: number };
  data?: string;
  message?: BotMessageRef;
}

type Step = ExpenseField | 'newPerson' | 'confirm';

interface Draft {
  mode: 'add' | 'edit';
  step: Step;
  data: Partial<ExpenseInput>;
  id?: number;
}

const ADD_STEPS: ExpenseField[] = [
  'date', 'item', 'itemEn', 'category', 'person', 'price', 'delivery', 'commission', 'hasReceipt', 'note',
];

const LABEL: Record<ExpenseField, string> = {
  date: 'Дата',
  item: 'Назва',
  itemEn: 'Назва англійською',
  category: 'Категорія',
  person: 'Людина',
  price: 'Ціна',
  delivery: 'Доставка',
  commission: 'Комісія',
  hasReceipt: 'Чек',
  note: 'Примітка',
};

const HELP =
  'Команди:\n' +
  '/add — додати витрату\n' +
  '/edit — змінити витрату\n' +
  '/delete — видалити витрату\n' +
  '/last — 10 останніх витрат\n' +
  '/cancel — скасувати поточну дію';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
const money = (n: number) => `${n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const short = (e: StoredExpense) => `${e.date.slice(8, 10)}.${e.date.slice(5, 7)} · ${e.item} · ${money(e.total)}`;

@Injectable()
export class ExpenseBotService {
  private readonly drafts = new Map<number, Draft>();

  constructor(
    private readonly bot: BotApi,
    private readonly ledger: LedgerRepository,
    private readonly database: DatabaseService,
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

    const command = /^\/(\w+)/.exec(text)?.[1];
    if (command && command !== 'start') {
      this.drafts.delete(telegramId);
      switch (command) {
        case 'add':
          this.drafts.set(telegramId, { mode: 'add', step: 'date', data: {} });
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
        case 'cancel':
          await this.bot.send(chatId, 'Скасовано.');
          return true;
        default:
          await this.bot.send(chatId, HELP);
          return true;
      }
    }

    const draft = this.drafts.get(telegramId);
    if (!draft || draft.step === 'confirm') return false;
    await this.accept(chatId, telegramId, draft, text);
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
        if (draft && draft.step !== 'confirm') await this.accept(chatId, telegramId, draft, arg, true);
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
        const [field, id] = arg.split('.') as [ExpenseField, string];
        if (!(field in LABEL)) return true;
        this.drafts.set(telegramId, { mode: 'edit', step: field, data: {}, id: Number(id) });
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

  private async ask(chatId: number, telegramId: number): Promise<void> {
    const draft = this.drafts.get(telegramId)!;
    const skip = (text: string, value = '-') => [[{ text, callback_data: `x:v:${value}` }]];
    switch (draft.step) {
      case 'date':
        return void (await this.bot.send(chatId, 'Дата (РРРР-ММ-ДД, напр. 2026-10-16):', skip('Сьогодні', 'today')));
      case 'item':
        return void (await this.bot.send(chatId, 'Назва українською (її видно всім на сайті):'));
      case 'itemEn':
        return void (await this.bot.send(chatId, 'Назва англійською:', skip('Пропустити')));
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
        rows.push([{ text: 'Загальна витрата', callback_data: 'x:v:none' }]);
        return void (await this.bot.send(chatId, 'Хто отримав:', rows));
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
        return void (await this.bot.send(chatId, 'Примітка (лише для закритого звіту):', skip('Без примітки')));
      case 'confirm':
        return void (await this.bot.send(chatId, this.summary(draft.data as ExpenseInput), [
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
    if (parsed.next) {
      draft.step = parsed.next;
      return this.ask(chatId, telegramId);
    }

    const field = draft.step === 'newPerson' ? 'person' : (draft.step as ExpenseField);
    (draft.data as Record<string, unknown>)[field] = parsed.value;

    if (draft.mode === 'edit') return this.saveEdit(chatId, telegramId, draft, field);

    const next = ADD_STEPS[ADD_STEPS.indexOf(field) + 1];
    draft.step = next ?? 'confirm';
    return this.ask(chatId, telegramId);
  }

  private parse(
    step: ExpenseField | 'newPerson',
    raw: string,
    button: boolean,
  ): { value: unknown; next?: undefined } | { next: Step } | { error: string } {
    switch (step) {
      case 'date': {
        const value = button && raw === 'today' ? today() : raw;
        const ok = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
        return ok ? { value } : { error: 'Дата має бути у форматі 2026-10-16.' };
      }
      case 'item':
        return raw ? { value: raw } : { error: 'Назва не може бути порожньою.' };
      case 'itemEn':
      case 'note':
        return { value: button && raw === '-' ? null : raw || null };
      case 'category': {
        const name = button ? this.ledger.categories()[Number(raw)] : raw;
        return name && this.ledger.categories().includes(name)
          ? { value: name }
          : { error: 'Виберіть категорію кнопкою.' };
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

  private summary(e: ExpenseInput): string {
    const total = e.price + e.delivery + e.commission;
    return [
      'Перевірте:',
      `Дата: ${e.date}`,
      `Назва: ${e.item}${e.itemEn ? ` / ${e.itemEn}` : ''}`,
      `Категорія: ${e.category}`,
      `Людина: ${e.person ?? '— (загальна)'}`,
      `Сума: ${money(total)} (ціна ${e.price} + доставка ${e.delivery} + комісія ${e.commission})`,
      `Чек: ${e.hasReceipt ? 'є' : 'немає'}`,
      `Примітка: ${e.note ?? '—'}`,
    ].join('\n');
  }

  private async save(chatId: number, telegramId: number, draft: Draft): Promise<void> {
    this.drafts.delete(telegramId);
    const data = draft.data as ExpenseInput;
    this.database.backup('bot');
    const id = this.ledger.add(data);
    this.securityLog.record('expense.add', {
      admin: telegramId,
      id,
      item: data.item,
      total: data.price + data.delivery + data.commission,
    });
    await this.bot.send(chatId, `✅ Записано (id ${id}). На сайті вже видно.`);
  }

  private async saveEdit(chatId: number, telegramId: number, draft: Draft, field: ExpenseField): Promise<void> {
    this.drafts.delete(telegramId);
    const before = this.ledger.get(draft.id!);
    if (!before) return void (await this.bot.send(chatId, 'Цієї витрати вже немає.'));
    const value = draft.data[field] as ExpenseInput[typeof field];
    this.database.backup('bot');
    this.ledger.update(draft.id!, field, value);
    this.securityLog.record('expense.edit', { admin: telegramId, id: draft.id, field, from: before[field], to: value });
    await this.bot.send(chatId, `✅ ${LABEL[field]}: ${this.show(before[field])} → ${this.show(value)}\n${short(this.ledger.get(draft.id!)!)}`);
  }

  private show(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'є' : 'немає';
    return String(value);
  }

  private async pickExpense(chatId: number, action: 'e' | 'd', title: string): Promise<void> {
    const recent = this.ledger.recent(10);
    if (recent.length === 0) return void (await this.bot.send(chatId, 'Витрат ще немає.'));
    await this.bot.send(
      chatId,
      title,
      recent.map((e) => [{ text: short(e), callback_data: `x:${action}:${e.id}` }]),
    );
  }

  private async chooseField(message: BotMessageRef, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    const fields = Object.keys(LABEL) as ExpenseField[];
    const rows: Keyboard = [];
    for (let i = 0; i < fields.length; i += 2) {
      rows.push(fields.slice(i, i + 2).map((f) => ({ text: LABEL[f], callback_data: `x:f:${f}.${id}` })));
    }
    await this.bot.edit(message, `${short(e)}\nЩо змінити?`, rows);
  }

  private async confirmDelete(message: BotMessageRef, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    await this.bot.edit(message, `Видалити?\n${short(e)}${e.person ? ` · ${e.person}` : ''}`, [
      [{ text: '🗑 Видалити', callback_data: `x:dd:${id}` }, { text: 'Скасувати', callback_data: 'x:no' }],
    ]);
  }

  private async remove(message: BotMessageRef, telegramId: number, id: number): Promise<void> {
    const e = this.ledger.get(id);
    if (!e) return void (await this.bot.edit(message, 'Цієї витрати вже немає.'));
    this.database.backup('bot');
    this.ledger.remove(id);
    this.securityLog.record('expense.delete', { admin: telegramId, id, item: e.item, total: e.total });
    await this.bot.edit(message, `🗑 Видалено: ${short(e)}`);
  }

  private async showLast(chatId: number): Promise<void> {
    const recent = this.ledger.recent(10);
    await this.bot.send(
      chatId,
      recent.length ? recent.map((e) => `${short(e)}${e.person ? ` · ${e.person}` : ''}`).join('\n') : 'Витрат ще немає.',
    );
  }
}
