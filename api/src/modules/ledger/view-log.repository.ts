import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/db';

export const VIEW_DEDUP_MS = 30_000;

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

  purgeBefore(before: number): number {
    return Number(
      this.database.connection.prepare('DELETE FROM report_views WHERE viewed_at < ?').run(before).changes,
    );
  }

}
