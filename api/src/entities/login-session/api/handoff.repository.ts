import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';

@Injectable()
export class HandoffRepository {
  constructor(private readonly database: DatabaseService) {}

  create(telegramId: number, ttlMs: number, origin?: string): string {
    const db = this.database.connection;
    db.prepare('DELETE FROM handoff_tokens WHERE expires_at <= ?').run(Date.now());

    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    db.prepare(
      'INSERT INTO handoff_tokens (token, telegram_id, expires_at, origin) VALUES (?, ?, ?, ?)',
    ).run(token, telegramId, now + ttlMs, origin ?? null);

    return token;
  }

  peek(token: string): number | undefined {
    const row = this.database.connection
      .prepare(
        'SELECT telegram_id FROM handoff_tokens WHERE token = ? AND consumed_at IS NULL AND expires_at > ?',
      )
      .get(token, Date.now()) as { telegram_id: number } | undefined;
    return row?.telegram_id;
  }

  consume(token: string): number | undefined {
    const db = this.database.connection;
    const result = db
      .prepare(
        'UPDATE handoff_tokens SET consumed_at = ? WHERE token = ? AND consumed_at IS NULL AND expires_at > ?',
      )
      .run(Date.now(), token, Date.now());

    if (result.changes === 0) return undefined;

    const row = db
      .prepare('SELECT telegram_id FROM handoff_tokens WHERE token = ?')
      .get(token) as { telegram_id: number } | undefined;
    return row?.telegram_id;
  }
}
