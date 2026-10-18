import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../../shared/db';
import { FundRepository } from '../fund';
import { LedgerRepository, LedgerService } from '../ledger';
import { ExpenseBotService, parseDate } from './expense-bot.service';

const ADMIN = 111;
const STRANGER = 222;
const CHAT = 1;

type Sent = { text: string; keyboard?: Array<Array<{ text: string; callback_data?: string }>> };

function setup(googleEnabled = true) {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  new FundRepository(db).seedIfEmpty();
  const repo = new LedgerRepository(db);
  const ledger = new LedgerService(repo, db);
  const sent: Sent[] = [];
  const rows = new Map<number, unknown[]>();
  const uploads: string[] = [];
  const trashed: string[] = [];
  const bot = {
    send: async (_chat: number, text: string, keyboard?: Sent['keyboard']) => void sent.push({ text, keyboard }),
    edit: async (_m: unknown, text: string, keyboard?: Sent['keyboard']) => void sent.push({ text, keyboard }),
    answer: async () => undefined,
    download: async () => ({ data: Buffer.from('x'), path: 'photos/a.jpg' }),
  };
  const google = {
    enabled: googleEnabled,
    upload: async (_k: string, _y: string, name: string) => {
      uploads.push(name);
      return `https://drive/${uploads.length}`;
    },
    ensureHeader: async () => undefined,
    syncRow: async (id: number, values: unknown[]) => void rows.set(id, values),
    deleteRow: async (id: number) => void rows.delete(id),
    trash: async (url: string) => void trashed.push(url),
  };
  const config = { get: (key: string) => (key === 'ADMIN_TELEGRAM_IDS' ? [ADMIN] : undefined) };
  const log = { record: () => undefined };
  const service = new ExpenseBotService(bot as never, ledger, google as never, log as never, config as never);
  const message = { message_id: 1, chat: { id: CHAT } };
  const say = (text: string, from = ADMIN) => service.handleMessage(from, CHAT, text);
  const press = (data: string, from = ADMIN) => service.handleCallback({ id: 'q', from: { id: from }, data, message });
  const last = () => sent[sent.length - 1]!;
  const button = (label: string) =>
    last().keyboard!.flat().find((b) => b.text === label)!.callback_data!;
  return { service, repo, sent, rows, uploads, trashed, say, press, last, button };
}

describe('ExpenseBotService', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it('ignores non-admins but tells anyone their id', async () => {
    expect(await t.say('/add', STRANGER)).toBe(false);
    expect(await t.say('/id', STRANGER)).toBe(true);
    expect(t.last().text).toBe(`Ваш Telegram ID: ${STRANGER}`);
  });

  it('adds an expense step by step, with receipts, and writes the sheet row', async () => {
    await t.say('/add');
    await t.say('2026-10-12');
    await t.say('Ремонт машини');
    await t.press('x:v:-');
    await t.say('заміна зчеплення');
    await t.press(t.button('Авто'));
    await t.press('x:v:new');
    await t.say('Лера');
    await t.say('21 080');
    await t.press('x:v:0');
    await t.say('15,5');
    await t.press('x:v:-');
    await t.press('x:v:1');
    await t.service.handleFile(ADMIN, CHAT, { fileId: 'f1' });
    await t.service.handleFile(ADMIN, CHAT, { fileId: 'f2', name: 'invoice.pdf', mime: 'application/pdf' });
    await t.press('x:v:done');
    await t.press('x:v:done');
    expect(t.last().text).toContain('Чек: є (завантажено 2)');
    await t.press('x:ok');

    const [e] = t.repo.recent(1);
    expect(e).toMatchObject({
      date: '2026-10-12', item: 'Ремонт машини', itemEn: null, description: 'заміна зчеплення',
      category: 'Авто', person: 'Лера', price: 21080, delivery: 0, commission: 15.5, hasReceipt: true, total: 21095.5,
    });
    expect(t.uploads).toEqual([
      '2026-10-12 Лера Ремонт машини (чек 1).jpg',
      '2026-10-12 Лера Ремонт машини (чек 2).pdf',
    ]);
    expect(t.rows.get(e!.id)).toEqual([
      'Ремонт машини', '2026-10-12', 21080, 0, 15.5, 'так', 21095.5,
      'Лера', 'Авто', 'заміна зчеплення', '', 'https://drive/1\nhttps://drive/2', '', e!.id,
    ]);
  });

  it('rejects bad input and asks again', async () => {
    await t.say('/add');
    await t.say('31.02.2026');
    expect(t.sent.at(-2)!.text).toContain('⚠️');
    await t.say('завтра');
    expect(t.sent.at(-2)!.text).toContain('⚠️');
  });

  it('caps receipts at 3', async () => {
    await t.say('/add');
    for (const step of ['2026-10-12', 'X']) await t.say(step);
    await t.press('x:v:-');
    await t.press('x:v:-');
    await t.press(t.button('Інше'));
    await t.press('x:v:none');
    await t.say('100');
    await t.press('x:v:0');
    await t.press('x:v:0');
    await t.press('x:v:-');
    await t.press('x:v:1');
    for (const id of ['a', 'b', 'c']) await t.service.handleFile(ADMIN, CHAT, { fileId: id });
    expect(t.last().text).toContain('фото-звіт');
  });

  it('edits one field and resyncs the row', async () => {
    const id = t.repo.add({
      date: '2026-10-12', item: 'Гума', itemEn: null, description: null, category: 'Авто', person: 'Лера',
      note: null, price: 100, delivery: 0, commission: 0, hasReceipt: false,
    });
    await t.say('/edit');
    await t.press(`x:e:${id}`);
    await t.press(`x:f:item.${id}`);
    await t.say('Шини на ЕВАК');
    expect(t.repo.get(id)!.item).toBe('Шини на ЕВАК');
    expect(t.rows.get(id)![0]).toBe('Шини на ЕВАК');
  });

  it('deletes after confirmation and removes the sheet row', async () => {
    const id = t.repo.add({
      date: '2026-10-12', item: 'X', itemEn: null, description: null, category: 'Інше', person: null,
      note: null, price: 1, delivery: 0, commission: 0, hasReceipt: false,
    });
    t.rows.set(id, []);
    t.repo.addFile(id, 'receipt', 'a.jpg', 'https://drive.google.com/file/d/AAA111/view');
    t.repo.addFile(id, 'photo', 'b.jpg', 'https://drive.google.com/file/d/BBB222/view');
    await t.say('/delete');
    await t.press(`x:d:${id}`);
    expect(t.repo.get(id)).toBeDefined();
    await t.press(`x:dd:${id}`);
    expect(t.repo.get(id)).toBeUndefined();
    expect(t.rows.has(id)).toBe(false);
    expect(t.trashed).toEqual([
      'https://drive.google.com/file/d/AAA111/view',
      'https://drive.google.com/file/d/BBB222/view',
    ]);
    expect(t.repo.files(id)).toEqual([]);
  });

  it('refuses callbacks from non-admins', async () => {
    const id = t.repo.add({
      date: '2026-10-12', item: 'X', itemEn: null, description: null, category: 'Інше', person: null,
      note: null, price: 1, delivery: 0, commission: 0, hasReceipt: false,
    });
    await t.press(`x:dd:${id}`, STRANGER);
    expect(t.repo.get(id)).toBeDefined();
  });

  it('without Google skips the receipt and photo steps', async () => {
    const g = setup(false);
    await g.say('/add');
    await g.say('2026-10-12');
    await g.say('X');
    await g.press('x:v:-');
    await g.press('x:v:-');
    await g.press(g.button('Інше'));
    await g.press('x:v:none');
    await g.say('100');
    await g.press('x:v:0');
    await g.press('x:v:0');
    await g.press('x:v:-');
    await g.press('x:v:1');
    expect(g.last().text).toContain('Перевірте');
    await g.press('x:ok');
    expect(g.repo.recent(1)[0]).toMatchObject({ item: 'X', total: 100, hasReceipt: true });
  });
});

describe('ExpenseBotService receipt question', () => {
  it('«Немає» skips the receipt upload and goes to photos', async () => {
    const t = setup();
    await t.say('/add');
    await t.say('12.10.2026');
    await t.say('X');
    await t.press('x:v:-');
    await t.press('x:v:-');
    await t.press(t.button('Інше'));
    await t.press('x:v:none');
    await t.say('100');
    await t.press('x:v:0');
    await t.press('x:v:0');
    await t.press('x:v:-');
    await t.press('x:v:0');
    expect(t.last().text).toContain('фото-звіт');
    await t.press('x:v:done');
    expect(t.last().text).toContain('Чек: немає');
  });

  it('«Є» without a file keeps the mark so the receipt can be added later', async () => {
    const t = setup();
    await t.say('/add');
    await t.say('12.10.2026');
    await t.say('X');
    await t.press('x:v:-');
    await t.press('x:v:-');
    await t.press(t.button('Інше'));
    await t.press('x:v:none');
    await t.say('100');
    await t.press('x:v:0');
    await t.press('x:v:0');
    await t.press('x:v:-');
    await t.press('x:v:1');
    expect(t.last().keyboard!.flat().map((b) => b.text)).toContain('Додам пізніше');
    await t.press('x:v:done');
    await t.press('x:v:done');
    await t.press('x:ok');
    expect(t.repo.recent(1)[0]!.hasReceipt).toBe(true);
  });
});

describe('parseDate', () => {
  const year = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' }).slice(0, 4);
  it.each([
    ['2026-10-12', '2026-10-12'],
    ['2026-1-5', '2026-01-05'],
    ['12.10.2026', '2026-10-12'],
    ['5.1.2026', '2026-01-05'],
    ['12/10/2026', '2026-10-12'],
    ['12.10.26', '2026-10-12'],
    ['12.10', `${year}-10-12`],
  ])('reads %s', (raw, expected) => expect(parseDate(raw)).toBe(expected));

  it.each(['31.02.2026', '13.13.2026', 'завтра', '', '2026/10'])('rejects %s', (raw) => expect(parseDate(raw)).toBeNull());

  it('knows today and yesterday', () => {
    expect(parseDate('сьогодні')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseDate('вчора')! < parseDate('сьогодні')!).toBe(true);
  });
});
