import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { runMigrations } from '../../infra/db/migrator';
import { VIEW_DEDUP_MS, ViewLogRepository } from './view-log.repository';
import type { DatabaseService } from '../../infra/db';

describe('ViewLogRepository', () => {
  it('records views and returns them newest first', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db, join(__dirname, '../../../migrations'));
    const repo = new ViewLogRepository({ connection: db } as unknown as DatabaseService);
    const since = (from: number) =>
      db
        .prepare('SELECT telegram_id, viewed_at, ip, user_agent FROM report_views WHERE viewed_at >= ? ORDER BY viewed_at DESC')
        .all(from) as Array<{ telegram_id: number; viewed_at: number; ip: string | null; user_agent: string | null }>;

    repo.record(1, 1000, '1.1.1.1', 'UA');
    repo.record(1, 1000 + VIEW_DEDUP_MS - 1);
    repo.record(2, 90_000);
    repo.record(1, 60_000, undefined, 'x'.repeat(500));

    const views = since(1500);
    expect(views.map((v) => [v.telegram_id, v.viewed_at])).toEqual([[2, 90_000], [1, 60_000]]);
    expect(since(0)).toHaveLength(3);
    expect(repo.purgeBefore(70_000)).toBe(2);
    expect(since(0).map((v) => v.telegram_id)).toEqual([2]);
    expect(views[1]!.user_agent).toHaveLength(300);
    expect(views[0]!.ip).toBeNull();
  });

  it('viewsSince returns rows at or after the bound, newest first, in camel case', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db, join(__dirname, '../../../migrations'));
    const repo = new ViewLogRepository({ connection: db } as unknown as DatabaseService);
    repo.record(1, 1000, '1.1.1.1', 'UA');
    repo.record(2, 5000);
    repo.record(3, 9000, '2.2.2.2');

    expect(repo.viewsSince(4000)).toEqual([
      { telegramId: 3, viewedAt: 9000, ip: '2.2.2.2', userAgent: null },
      { telegramId: 2, viewedAt: 5000, ip: null, userAgent: null },
    ]);
    expect(repo.viewsSince(10_000)).toEqual([]);
  });
});
