#!/usr/bin/env node

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app/app.module.js';
import { DatabaseService } from '../dist/shared/db/database.service.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

try {
  const db = app.get(DatabaseService);
  const rows = db.connection
    .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
    .all();
  console.log('застосовані міграції:');
  for (const row of rows) {
    console.log(`  ${row.version}  ${new Date(row.applied_at).toISOString()}`);
  }
} finally {
  await app.close();
}
