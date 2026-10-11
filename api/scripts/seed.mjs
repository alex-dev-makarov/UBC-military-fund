#!/usr/bin/env node

import 'reflect-metadata';

process.env.TELEGRAM_BOT_POLLING = 'false';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app/app.module.js');
const { FundRepository } = await import('../dist/entities/fund/api/fund.repository.js');

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

try {
  const fund = app.get(FundRepository);
  const seeded = fund.seedIfEmpty();

  if (!seeded) {
    console.log('fund_meta вже має дані — сідер пропущено (це не помилка)');
  } else {
    const result = fund.getPublicFund();
    console.log(
      `засіяно: regions ${result.regions.length} · categories ${result.categories.length} · ` +
        `years ${result.years.length} · months ${result.months.length} · recent ${result.recent.length}`,
    );
  }
} finally {
  await app.close();
}
