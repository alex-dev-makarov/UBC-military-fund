import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './database.service';

export function memoryDatabase(): DatabaseService {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return db;
}

describe('DatabaseService', () => {
  it('creates every table in the schema on boot', () => {
    const db = memoryDatabase();
    const tables = (
      db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(tables).toEqual([
      'fund_categories',
      'fund_meta',
      'fund_regions',
      'handoff_tokens',
      'login_nonces',
      'private_expense_files',
      'private_expenses',
      'private_meta',
      'private_year_categories',
      'private_years',
      'report_views',
      'schema_migrations',
      'security_events',
      'users',
    ]);
  });

  it('refuses to hand out a connection before onModuleInit', () => {
    
    
    const db = new DatabaseService({ get: () => ':memory:' } as never);
    expect(() => db.connection).toThrow(/before onModuleInit/);
  });

  it('is idempotent across repeated migrations', () => {
    
    
    
    const db = memoryDatabase();
    expect(() => db.onModuleInit()).not.toThrow();
  });

  it('records every migration file it applied', () => {
    const db = memoryDatabase();
    const versions = (
      db.connection
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: string }>
    ).map((row) => row.version);

    expect(versions).toEqual([
      '0001_init',
      '0002_fund',
      '0003_login_nonces',
      '0004_membership_cache',
      '0005_oidc_states',
      '0006_anonymous_users',
      '0007_handoff_tokens',
      '0008_drop_used_hashes',
      '0009_login_origin',
      '0010_cleanup',
      '0011_private_ledger',
      '0012_report_views',
      '0013_login_confirm',
      '0014_security_hardening',
      '0015_unified_ledger',
      '0016_expense_files',
    ]);
  });
});

describe('DatabaseService.health', () => {
  it('reports a live database with real row counts', () => {
    const db = memoryDatabase();
    db.connection
      .prepare('INSERT INTO users (telegram_id, first_seen_at, last_login_at) VALUES (1, 0, 0)')
      .run();

    expect(db.health()).toMatchObject({ ok: true, users: 1, path: ':memory:' });
  });

  it('reports a closed database as not ok instead of throwing', () => {
    
    
    
    const db = memoryDatabase();
    db.onModuleDestroy();

    const health = db.health();
    expect(health.ok).toBe(false);
    expect(health.error).toBeTruthy();
  });
});

describe('DatabaseService journal mode', () => {
  it('defaults to DELETE so host-side edits are visible to a live connection', () => {
    
    
    
    const db = memoryDatabase();
    const { journal_mode: mode } = db.connection.prepare('PRAGMA journal_mode').get() as {
      journal_mode: string;
    };
    
    
    expect(['delete', 'memory']).toContain(mode);
  });

  it('rejects a bogus SQLITE_JOURNAL_MODE at boot instead of ignoring it', () => {
    const previous = process.env.SQLITE_JOURNAL_MODE;
    process.env.SQLITE_JOURNAL_MODE = 'nonsense; DROP TABLE users';
    try {
      const db = new DatabaseService({ get: () => ':memory:' } as never);
      expect(() => db.onModuleInit()).toThrow(/SQLITE_JOURNAL_MODE/);
    } finally {
      if (previous === undefined) delete process.env.SQLITE_JOURNAL_MODE;
      else process.env.SQLITE_JOURNAL_MODE = previous;
    }
  });
});

describe('DatabaseService.tableCounts', () => {
  it('returns every table with its row count, sorted by name', () => {
    const db = memoryDatabase();
    db.connection.prepare("INSERT INTO fund_regions (name_uk, name_en, sort) VALUES ('а', 'a', 0)").run();
    db.connection.prepare("INSERT INTO fund_regions (name_uk, name_en, sort) VALUES ('б', 'b', 1)").run();

    const counts = db.tableCounts();
    const names = counts.map((row) => row.name);

    expect(names).toEqual([...names].sort());
    expect(counts.find((row) => row.name === 'fund_regions')).toEqual({ name: 'fund_regions', count: 2 });
    expect(counts.find((row) => row.name === 'users')).toEqual({ name: 'users', count: 0 });
  });
});

describe('DatabaseService read-only mode (DB_READONLY=1)', () => {
  afterEach(() => {
    delete process.env.DB_READONLY;
  });

  const serviceFor = (path: string): DatabaseService => new DatabaseService({ get: () => path } as never);
  const freshPath = (): string => join(mkdtempSync(join(tmpdir(), 'dbro-')), 'ro.sqlite');

  it('opens a migrated database read-only and refuses writes', () => {
    const path = freshPath();
    const rw = serviceFor(path);
    rw.onModuleInit();
    rw.onModuleDestroy();

    process.env.DB_READONLY = '1';
    const ro = serviceFor(path);
    ro.onModuleInit();
    expect(ro.tableCounts().length).toBeGreaterThan(0);
    expect(() => ro.connection.exec('DELETE FROM users')).toThrow(/readonly/i);
    ro.onModuleDestroy();
  });

  it('does not migrate: fails clearly when migrations are pending and leaves the file untouched', () => {
    const path = freshPath();
    new DatabaseSync(path).close();

    process.env.DB_READONLY = '1';
    expect(() => serviceFor(path).onModuleInit()).toThrow(/потребує міграцій/);

    const check = new DatabaseSync(path);
    expect(check.prepare("SELECT count(*) AS c FROM sqlite_master").get()).toEqual({ c: 0 });
    check.close();
  });
});
