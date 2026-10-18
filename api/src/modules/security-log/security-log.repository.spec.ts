import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { runMigrations } from '../../infra/db/migrator';
import { SecurityLogRepository } from './security-log.repository';
import type { DatabaseService } from '../../infra/db';

describe('SecurityLogRepository', () => {
  it('inserts rows and purges only those older than the cut-off', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db, join(__dirname, '../../../migrations'));
    db.exec('DROP TRIGGER security_events_keep_recent');
    const repo = new SecurityLogRepository({ connection: db } as unknown as DatabaseService);
    const rows = () =>
      db.prepare('SELECT ts, event, data FROM security_events ORDER BY ts').all() as Array<{
        ts: number;
        event: string;
        data: string;
      }>;

    repo.insert(1000, 'auth.start', '{}');
    repo.insert(2000, 'report.view', '{"a":1}');
    expect(rows()).toEqual([
      { ts: 1000, event: 'auth.start', data: '{}' },
      { ts: 2000, event: 'report.view', data: '{"a":1}' },
    ]);

    expect(repo.purgeBefore(1500)).toBe(1);
    expect(rows().map((r) => r.ts)).toEqual([2000]);
    expect(repo.purgeBefore(0)).toBe(0);
  });
});
