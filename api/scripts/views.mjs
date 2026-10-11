#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite';

const days = Number(process.argv[2] ?? 7);
if (!Number.isFinite(days) || days <= 0) {
  console.error('використання: pnpm views [кількість днів, за замовчуванням 7]');
  process.exit(1);
}

const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/ubc.sqlite', { readOnly: true });
const from = Date.now() - days * 86_400_000;
const rows = db
  .prepare(
    'SELECT telegram_id, viewed_at, ip, user_agent FROM report_views WHERE viewed_at >= ? ORDER BY viewed_at DESC',
  )
  .all(from);

if (rows.length === 0) {
  console.log(`за останні ${days} дн. переглядів немає`);
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;
const names = new Map();
for (const id of new Set(rows.map((r) => r.telegram_id))) {
  let name = '?';
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, user_id: id }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const u = data.result?.user;
    if (u) {
      name = [u.first_name, u.last_name].filter(Boolean).join(' ');
      if (u.username) name += ` @${u.username}`;
      if (!['creator', 'administrator', 'member'].includes(data.result.status)) name += ' (вже не в каналі)';
    }
  } catch {
    name = '? (Telegram недоступний)';
  }
  names.set(id, name);
}

const time = (ms) =>
  new Date(ms).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });
const device = (ua) =>
  !ua ? '' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Telegram/.test(ua) ? 'Telegram' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'інше';

const byPerson = new Map();
for (const r of rows) {
  const p = byPerson.get(r.telegram_id) ?? { count: 0, last: r.viewed_at };
  p.count += 1;
  byPerson.set(r.telegram_id, p);
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
  rows.slice(0, 30).map((r) => ({
    'Час (Київ)': time(r.viewed_at),
    'Telegram ID': r.telegram_id,
    'Імʼя': names.get(r.telegram_id),
    'IP': r.ip ?? '',
    'Пристрій': device(r.user_agent),
  })),
);
