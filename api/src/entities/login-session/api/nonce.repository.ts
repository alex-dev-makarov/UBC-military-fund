import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';
import type { NonceRecord } from '../model/types';

@Injectable()
export class NonceRepository {
  constructor(private readonly database: DatabaseService) {}

  create(ttlMs: number, origin?: string): NonceRecord {
    const db = this.database.connection;

    db.prepare('DELETE FROM login_nonces WHERE expires_at <= ?').run(Date.now());

    const nonce = randomBytes(32).toString('base64url');
    const now = Date.now();
    db.prepare(
      'INSERT INTO login_nonces (nonce, expires_at, status, origin) VALUES (?, ?, ?, ?)',
    ).run(nonce, now + ttlMs, 'pending', origin ?? null);

    return this.find(nonce)!;
  }

  find(nonce: string): NonceRecord | undefined {
    return this.database.connection
      .prepare('SELECT * FROM login_nonces WHERE nonce = ?')
      .get(nonce) as NonceRecord | undefined;
  }

  authorize(nonce: string, telegramId: number): boolean {
    const result = this.database.connection
      .prepare(
        `UPDATE login_nonces
            SET status = 'authorized', telegram_id = ?
          WHERE nonce = ? AND status = 'pending' AND expires_at > ?`,
      )
      .run(telegramId, nonce, Date.now());
    return result.changes > 0;
  }

  deny(nonce: string): boolean {
    const result = this.database.connection
      .prepare(
        `UPDATE login_nonces SET status = 'denied'
          WHERE nonce = ? AND status = 'pending' AND expires_at > ?`,
      )
      .run(nonce, Date.now());
    return result.changes > 0;
  }

  consume(nonce: string): NonceRecord | undefined {
    const db = this.database.connection;
    const result = db
      .prepare(
        `UPDATE login_nonces SET consumed_at = ?
          WHERE nonce = ? AND status = 'authorized' AND consumed_at IS NULL AND expires_at > ?`,
      )
      .run(Date.now(), nonce, Date.now());

    if (result.changes === 0) return undefined;
    return this.find(nonce);
  }
}
