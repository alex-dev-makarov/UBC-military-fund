#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const sql = process.argv.slice(2).join(' ').trim();

const runner = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/data/ubc.sqlite');
const sql = process.env.UBC_SQL;

if (!sql) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  console.log('таблиці:');
  for (const { name } of tables) {
    const { c } = db.prepare('SELECT count(*) AS c FROM ' + name).get();
    console.log('  ' + String(name).padEnd(18) + c);
  }
  console.log('\\nприклад: pnpm db "SELECT * FROM fund_meta"');
} else if (/^\\s*(select|pragma|explain|with)\\b/i.test(sql)) {
  const rows = db.prepare(sql).all();
  if (rows.length === 0) console.log('(порожньо)');
  else console.table(rows.map((r) => ({ ...r })));
} else {
  const result = db.prepare(sql).run();
  console.log('змінено рядків:', result.changes);
}
`;

const result = spawnSync(
  'docker',
  ['compose', 'exec', '-T', '-e', `UBC_SQL=${sql}`, 'api', 'node', '-e', runner],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('не вдалося запустити docker:', result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\nконтейнер не відповів. Піднятий? → pnpm docker:up');
}
process.exit(result.status ?? 1);
