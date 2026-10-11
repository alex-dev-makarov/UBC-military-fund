#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const write = args[0] === '--write';
const sql = (write ? args.slice(1) : args).join(' ').trim();
const PROTECTED = /\b(report_views|security_events|schema_migrations)\b/i;

const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
if (write && PROTECTED.test(withoutComments)) {
  console.error('журнали (report_views, security_events) і schema_migrations змінювати вручну не можна');
  process.exit(1);
}

const runner = `
const { DatabaseSync } = require('node:sqlite');
const write = process.argv[1] === 'write';
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const sql = Buffer.concat(chunks).toString('utf8').trim();
  const db = new DatabaseSync('/app/data/ubc.sqlite', { readOnly: !write });
  if (!sql) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('таблиці:');
    for (const { name } of tables) {
      const { c } = db.prepare('SELECT count(*) AS c FROM ' + name).get();
      console.log('  ' + String(name).padEnd(20) + c);
    }
    console.log('\\nчитати:   pnpm db "SELECT * FROM fund_meta"');
    console.log('змінити:  pnpm db --write "UPDATE ..."');
    return;
  }
  const statement = db.prepare(sql);
  if (statement.columns().length > 0) {
    const rows = statement.all();
    if (rows.length === 0) console.log('(порожньо)');
    else console.table(rows.map((r) => ({ ...r })));
  } else {
    console.log('змінено рядків:', statement.run().changes);
  }
});
`;

const result = spawnSync(
  'docker',
  ['compose', 'exec', '-T', 'api', 'node', '-e', runner, write ? 'write' : 'read'],
  { input: sql, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.error) {
  console.error('не вдалося запустити docker:', result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  if (!write && /^\s*(insert|update|delete|replace|create|drop|alter|with)\b/i.test(withoutComments)) {
    console.error('\nбаза відкрита лише для читання. Щоб змінити дані: pnpm db --write "..."');
  } else {
    console.error('\nзапит не виконано (див. помилку вище). Контейнер піднятий? → pnpm docker:up');
  }
}
process.exit(result.status ?? 1);
