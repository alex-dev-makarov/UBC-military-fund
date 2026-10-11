#!/usr/bin/env node

import 'reflect-metadata';

process.env.TELEGRAM_BOT_POLLING = 'false';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app/app.module.js');
const { LedgerRepository } = await import('../dist/entities/report/api/ledger.repository.js');

const command = process.argv[2];
if (!['export', 'import', 'demo'].includes(command)) {
  console.error('використання: node scripts/private.mjs export|import|demo');
  process.exit(1);
}

if (command === 'demo' && process.env.APP_ENV !== 'local' && process.env.APP_ENV !== 'dev') {
  console.error(`demo-дані заборонені для APP_ENV=${process.env.APP_ENV ?? '(не задано)'} — це затерло б реальний звіт`);
  process.exit(1);
}

if (command === 'import' && process.env.APP_ENV !== 'prod') {
  console.error(`імпорт реальних даних дозволений лише на prod (тут APP_ENV=${process.env.APP_ENV ?? '(не задано)'}); для dev/local є demo`);
  process.exit(1);
}

const DEMO = {
  generatedAt: '2026-10-01',
  years: [{ year: 2025, summaryTotal: 50000, hasReceipt: true }, { year: 2026 }],
  expenses: [
    { date: '2026-01-14', item: 'Спальник', person: 'Іваненко', price: 3200, hasReceipt: true },
    { date: '2026-02-03', item: 'Ремонт авто', person: 'Петренко', price: 12500, hasReceipt: true },
    { date: '2026-03-18', item: 'Павербанк', person: 'Коваль', price: 2400, delivery: 120, hasReceipt: true },
    { date: '2026-04-09', item: 'Збір на авто', person: 'Петренко', price: 20000, hasReceipt: true },
    { date: '2026-05-22', item: 'Рація', person: 'Шевчук', price: 8700, commission: 50, hasReceipt: true },
    { date: '2026-06-30', item: 'Ремонт авто', person: 'Іваненко', price: 6400, note: 'позика', hasReceipt: true },
    { date: '2026-07-12', item: 'Домен (рік)', person: null, price: 500, hasReceipt: true },
    { date: '2026-08-25', item: 'Ноутбук', person: 'Бондар', price: 25000, hasReceipt: false },
    { date: '2026-09-15', item: 'Ремонт авто', person: 'Петренко', price: 9100, hasReceipt: true },
  ],
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
try {
  const ledger = app.get(LedgerRepository);
  if (command === 'export') {
    process.stdout.write(JSON.stringify(ledger.exportAll()));
  } else {
    const result = ledger.replaceAll(command === 'demo' ? DEMO : JSON.parse(await readStdin()));
    const report = ledger.getReport();
    console.error(
      `імпортовано: років ${result.years} · витрат ${result.expenses} · людей ${report.people.length} · ` +
        `разом ${report.total.toFixed(2)} ₴`,
    );
  }
} finally {
  await app.close();
}
