import { ConfigService } from '@nestjs/config';
import type { CliCommand } from '../command.types';
import type { ValidatedEnv } from '../../infra/config/env.types';
import { TelegramService } from '../../integrations/telegram';
import { LedgerService, type ViewLogRow } from '../../modules/ledger';

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES: readonly string[] = ['creator', 'administrator', 'member'];
const PREVIEW_ROWS = 30;

const viewDays = (args: readonly string[]): number => Number(args[0] ?? 7);

const time = (ms: number): string =>
  new Date(ms).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });

const device = (ua: string | null): string =>
  !ua
    ? ''
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Telegram/.test(ua)
          ? 'Telegram'
          : /Mac OS/.test(ua)
            ? 'Mac'
            : /Windows/.test(ua)
              ? 'Windows'
              : 'інше';

/**
 * Display name for a viewer, looked up in the channel. Falls back to '?' when Telegram has no
 * record of the user, and to '? (Telegram недоступний)' when the lookup itself fails.
 */
export async function lookupViewerName(
  telegram: Pick<TelegramService, 'getChatMember'>,
  userId: number,
  chatId: string,
  token: string,
): Promise<string> {
  try {
    const member = await telegram.getChatMember(userId, chatId, token);
    const user = member?.user;
    if (!member || !user) return '?';
    let name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (user.username) name += ` @${user.username}`;
    if (!ACTIVE_STATUSES.includes(member.status ?? '')) name += ' (вже не в каналі)';
    return name;
  } catch {
    return '? (Telegram недоступний)';
  }
}

/** Prints the per-viewer summary and the latest views. `rows` must be newest first. */
export function printViewsReport(
  days: number,
  rows: readonly ViewLogRow[],
  names: ReadonlyMap<number, string>,
): void {
  const byPerson = new Map<number, { count: number; last: number }>();
  for (const r of rows) {
    const p = byPerson.get(r.telegramId) ?? { count: 0, last: r.viewedAt };
    p.count += 1;
    byPerson.set(r.telegramId, p);
  }

  console.log(`\nХто відкривав закритий звіт за останні ${days} дн.:`);
  console.table(
    [...byPerson].map(([id, p]) => ({
      'Telegram ID': id,
      'Імʼя (з Telegram)': names.get(id),
      'Переглядів': p.count,
      'Останній': time(p.last),
    })),
  );

  console.log('\nОстанні перегляди:');
  console.table(
    rows.slice(0, PREVIEW_ROWS).map((r) => ({
      'Час (Київ)': time(r.viewedAt),
      'Telegram ID': r.telegramId,
      'Імʼя': names.get(r.telegramId),
      'IP': r.ip ?? '',
      'Пристрій': device(r.userAgent),
    })),
  );
}

/** Who opened the closed report in the last N days, with names from the channel. */
export const reportViewsCommand: CliCommand = {
  name: 'report:views',
  usage: 'report:views [днів]',
  readOnly: true,
  precheck: (args) => {
    const days = viewDays(args);
    return Number.isFinite(days) && days > 0
      ? null
      : 'використання: report:views [кількість днів, за замовчуванням 7]';
  },
  run: async (app, args) => {
    const days = viewDays(args);
    const rows = app.get(LedgerService).viewsSince(Date.now() - days * DAY_MS);
    if (rows.length === 0) {
      console.log(`за останні ${days} дн. переглядів немає`);
      return;
    }

    const config = app.get<ConfigService<ValidatedEnv, true>>(ConfigService);
    const token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    const chat = config.get('TELEGRAM_CHAT_ID', { infer: true });
    const telegram = app.get(TelegramService);

    const names = new Map<number, string>();
    for (const id of new Set(rows.map((r) => r.telegramId))) {
      names.set(id, await lookupViewerName(telegram, id, chat, token));
    }
    printViewsReport(days, rows, names);
  },
};
