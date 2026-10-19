import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../../integrations/telegram';
import { LedgerService } from '../../modules/ledger';
import { fakeApp } from '../test-app';
import { lookupViewerName, printViewsReport, reportViewsCommand } from './report-views.command';

const CHAT = '-100';
const TOKEN = 'token';

function telegramReturning(
  getChatMember: (...args: [number, string, string]) => Promise<unknown>,
): Pick<TelegramService, 'getChatMember'> {
  return { getChatMember } as unknown as Pick<TelegramService, 'getChatMember'>;
}

describe('report:views precheck', () => {
  it.each([[[]], [['7']], [['1.5']]])('accepts days %j', (args) => {
    expect(reportViewsCommand.precheck?.(args, {})).toBeNull();
  });

  it.each([[['abc']], [['0']], [['-3']], [['']]])('refuses days %j with the usage message', (args) => {
    expect(reportViewsCommand.precheck?.(args, {})).toBe(
      'використання: report:views [кількість днів, за замовчуванням 7]',
    );
  });
});

describe('lookupViewerName', () => {
  it('builds the name, username and no suffix for an active member', async () => {
    const telegram = telegramReturning(async () => ({
      status: 'member',
      user: { first_name: 'Ada', last_name: 'Lovelace', username: 'ada' },
    }));
    await expect(lookupViewerName(telegram, 1, CHAT, TOKEN)).resolves.toBe('Ada Lovelace @ada');
  });

  it('omits missing parts and flags users who left the channel', async () => {
    const telegram = telegramReturning(async () => ({ status: 'left', user: { first_name: 'Bob' } }));
    await expect(lookupViewerName(telegram, 1, CHAT, TOKEN)).resolves.toBe('Bob (вже не в каналі)');
  });

  it('answers "?" when Telegram has no result for the user', async () => {
    await expect(lookupViewerName(telegramReturning(async () => null), 1, CHAT, TOKEN)).resolves.toBe('?');
  });

  it('answers "? (Telegram недоступний)" when the lookup fails', async () => {
    const telegram = telegramReturning(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(lookupViewerName(telegram, 1, CHAT, TOKEN)).resolves.toBe('? (Telegram недоступний)');
  });
});

describe('printViewsReport', () => {
  it('groups views per viewer with the latest timestamp first and maps device labels', () => {
    const rows = [
      { telegramId: 7, viewedAt: Date.UTC(2026, 9, 16, 8), ip: '1.1.1.1', userAgent: 'Mozilla (iPhone)' },
      { telegramId: 7, viewedAt: Date.UTC(2026, 9, 15, 8), ip: null, userAgent: null },
      { telegramId: 9, viewedAt: Date.UTC(2026, 9, 14, 8), ip: null, userAgent: 'curl' },
    ];
    const names = new Map([
      [7, 'Ada'],
      [9, '?'],
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});

    printViewsReport(7, rows, names);

    expect(log).toHaveBeenCalledWith('\nХто відкривав закритий звіт за останні 7 дн.:');
    const [summary, latest] = table.mock.calls as unknown as Array<[Array<Record<string, unknown>>]>;
    expect(summary![0]).toEqual([
      { 'Telegram ID': 7, 'Імʼя (з Telegram)': 'Ada', 'Переглядів': 2, 'Останній': expect.any(String) },
      { 'Telegram ID': 9, 'Імʼя (з Telegram)': '?', 'Переглядів': 1, 'Останній': expect.any(String) },
    ]);
    expect(latest![0]!.map((row) => row['Пристрій'])).toEqual(['iOS', '', 'інше']);
    expect(latest![0]![1]!['IP']).toBe('');
  });
});

describe('report:views run', () => {
  it('prints the empty-window message and does not call Telegram', async () => {
    const ledger = { viewsSince: vi.fn(() => []) };
    const telegram = { getChatMember: vi.fn() };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await reportViewsCommand.run(
      fakeApp(new Map<unknown, unknown>([[LedgerService, ledger], [TelegramService, telegram]])),
      ['3'],
    );

    expect(ledger.viewsSince).toHaveBeenCalledWith(expect.any(Number));
    expect(log).toHaveBeenCalledWith('за останні 3 дн. переглядів немає');
    expect(telegram.getChatMember).not.toHaveBeenCalled();
  });

  it('looks up each unique viewer once and passes token and chat from config', async () => {
    const ledger = {
      viewsSince: vi.fn(() => [
        { telegramId: 5, viewedAt: 2, ip: null, userAgent: null },
        { telegramId: 5, viewedAt: 1, ip: null, userAgent: null },
      ]),
    };
    const telegram = { getChatMember: vi.fn(async () => null) };
    const config = { get: vi.fn((key: string) => (key === 'TELEGRAM_BOT_TOKEN' ? 'tok' : '-100')) };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});

    await reportViewsCommand.run(
      fakeApp(
        new Map<unknown, unknown>([
          [LedgerService, ledger],
          [ConfigService, config],
          [TelegramService, telegram],
        ]),
      ),
      [],
    );

    expect(telegram.getChatMember).toHaveBeenCalledTimes(1);
    expect(telegram.getChatMember).toHaveBeenCalledWith(5, '-100', 'tok');
    expect(table).toHaveBeenCalledTimes(2);
  });
});
