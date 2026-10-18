import { dirname, join } from 'node:path';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../config/env.types';
import { pendingMigrations, runMigrations } from './migrator';

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

    // Set by the CLI for commands that must not touch the working database (see CliCommand.readOnly).
    const readOnly = process.env.DB_READONLY === '1';

    if (path !== ':memory:' && !readOnly) {

      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path, { readOnly });

    if (readOnly) {
      this.db.exec('PRAGMA foreign_keys = ON');
      const pending = pendingMigrations(this.db);
      if (pending.length > 0) {
        this.db.close();
        throw new Error(
          `база ${path} потребує міграцій (${pending.join(', ')}), а команда працює в режимі лише читання — ` +
            'запустіть застосунок або будь-яку команду без readOnly, щоб застосувати міграції',
        );
      }
      return;
    }

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

  backup(label: string, keep = 30): void {
    if (this.path === ':memory:') return;
    const dir = dirname(this.path);
    const stamp = new Date().toISOString().replace(/[-:.]/g, '');
    this.db.exec(`VACUUM INTO '${join(dir, `backup-${label}-${stamp}.sqlite`)}'`);
    readdirSync(dir)
      .filter((name) => name.startsWith(`backup-${label}-`))
      .sort()
      .slice(0, -keep)
      .forEach((name) => rmSync(join(dir, name)));
  }

  /** Row count per user table, for read-only inspection (`cli db:stats`). */
  tableCounts(): Array<{ name: string; count: number }> {
    const tables = this.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    return tables.map(({ name }) => {
      const row = this.connection
        .prepare(`SELECT count(*) AS c FROM "${name.replace(/"/g, '""')}"`)
        .get() as { c: number };
      return { name, count: row.c };
    });
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
