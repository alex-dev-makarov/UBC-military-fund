import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../config/env.types';
import { runMigrations } from './migrator';

export interface DatabaseHealth {
  ok: boolean;
  path: string;
  users: number;
  error?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: DatabaseSync;
  private path = '';

  constructor(private readonly config: ConfigService<ValidatedEnv, true>) {}

  get connection(): DatabaseSync {
    if (!this.db) {
      throw new Error('Database accessed before onModuleInit — check module wiring');
    }
    return this.db;
  }

  onModuleInit(): void {
    const path = this.config.get('DATABASE_PATH', { infer: true });
    this.path = path;

    if (path !== ':memory:') {

      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);

    const journalMode = process.env.SQLITE_JOURNAL_MODE ?? 'DELETE';
    if (!/^(DELETE|WAL|TRUNCATE|PERSIST|MEMORY|OFF)$/i.test(journalMode)) {
      throw new Error(`SQLITE_JOURNAL_MODE must be a valid SQLite journal mode, got: ${journalMode}`);
    }
    this.db.exec(`PRAGMA journal_mode = ${journalMode}`);

    this.db.exec('PRAGMA foreign_keys = ON');

    this.migrate();
  }

  onModuleDestroy(): void {
    this.db?.close();
  }

  private migrate(): void {
    const { applied } = runMigrations(this.db);
    if (applied.length > 0) {
      console.log(`[db] applied migrations: ${applied.join(', ')}`);
    }
  }

  health(): DatabaseHealth {
    const base = { path: this.path };
    try {
      const users = this.db.prepare('SELECT count(*) AS c FROM users').get() as { c: number };
      return { ...base, ok: true, users: users.c };
    } catch (error) {
      return {
        ...base,
        ok: false,
        users: -1,
        error: error instanceof Error ? error.message : 'unknown database error',
      };
    }
  }
}
