import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/db';

export const VIEW_DEDUP_MS = 30_000;

export interface ViewLogRow {
  telegramId: number;
  viewedAt: number;
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class ViewLogRepository {
  constructor(private readonly database: DatabaseService) {}

  record(telegramId: number, at: number, ip?: string, userAgent?: string): boolean {
    const recent = this.database.connection
      .prepare('SELECT 1 FROM report_views WHERE telegram_id = ? AND viewed_at > ? LIMIT 1')
      .get(telegramId, at - VIEW_DEDUP_MS);
    if (recent) return false;

    this.database.connection
      .prepare('INSERT INTO report_views (telegram_id, viewed_at, ip, user_agent) VALUES (?, ?, ?, ?)')
      .run(telegramId, at, ip ?? null, userAgent?.slice(0, 300) ?? null);
    return true;
  }

  /** Views at or after `from` (ms epoch), newest first. Read-only. */
  viewsSince(from: number): ViewLogRow[] {
    const rows = this.database.connection
      .prepare(
        'SELECT telegram_id, viewed_at, ip, user_agent FROM report_views WHERE viewed_at >= ? ORDER BY viewed_at DESC',
      )
      .all(from) as Array<{ telegram_id: number; viewed_at: number; ip: string | null; user_agent: string | null }>;
    return rows.map((r) => ({
      telegramId: r.telegram_id,
      viewedAt: r.viewed_at,
      ip: r.ip,
      userAgent: r.user_agent,
    }));
  }

  purgeBefore(before: number): number {
    return Number(
      this.database.connection.prepare('DELETE FROM report_views WHERE viewed_at < ?').run(before).changes,
    );
  }
}
