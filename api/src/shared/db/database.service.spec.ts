import { describe, expect, it } from 'vitest';
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
      'fund_months',
      'fund_recent',
      'fund_regions',
      'fund_years',
      'handoff_tokens',
      'login_nonces',
      'schema_migrations',
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
