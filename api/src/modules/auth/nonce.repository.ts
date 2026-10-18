import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/db';
import type { ConfirmResult, NewNonce, NonceRecord } from './login-session.types';

@Injectable()
export class NonceRepository {
  constructor(private readonly database: DatabaseService) {}

  create(ttlMs: number, input: NewNonce): NonceRecord {
    const db = this.database.connection;
    db.prepare('DELETE FROM login_nonces WHERE expires_at <= ?').run(Date.now());

    const nonce = randomBytes(32).toString('base64url');
    db.prepare(
      `INSERT INTO login_nonces (nonce, expires_at, status, origin, code, choices, binding_hash, client)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
    ).run(
      nonce,
      Date.now() + ttlMs,
      input.origin ?? null,
      input.code,
      input.choices.join(','),
      input.bindingHash,
      input.client ?? null,
    );
    return this.find(nonce)!;
  }

  find(nonce: string): NonceRecord | undefined {
    return this.database.connection
      .prepare('SELECT * FROM login_nonces WHERE nonce = ?')
      .get(nonce) as NonceRecord | undefined;
  }

  startConfirm(nonce: string, telegramId: number): boolean {
    const db = this.database.connection;
    const now = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db
        .prepare(
          `UPDATE login_nonces SET status = 'confirming', telegram_id = ?
            WHERE nonce = ? AND status = 'pending' AND expires_at > ?`,
        )
        .run(telegramId, nonce, now);
      if (result.changes > 0) {
        db.prepare(
          `UPDATE login_nonces SET status = 'denied'
            WHERE telegram_id = ? AND status = 'confirming' AND nonce <> ?`,
        ).run(telegramId, nonce);
      }
      db.exec('COMMIT');
      return result.changes > 0;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }


  denyUnconsumedFor(telegramId: number): number {
    return Number(
      this.database.connection
        .prepare(
          `UPDATE login_nonces SET status = 'denied'
            WHERE telegram_id = ? AND consumed_at IS NULL AND status IN ('confirming', 'authorized')`,
        )
        .run(telegramId).changes,
    );
  }

  confirm(nonce: string, telegramId: number, picked: number): ConfirmResult {
    const db = this.database.connection;
    const result = db
      .prepare(
        `UPDATE login_nonces
            SET status = CASE WHEN code = ? THEN 'authorized' ELSE 'denied' END
          WHERE nonce = ? AND status = 'confirming' AND telegram_id = ? AND expires_at > ?`,
      )
      .run(picked, nonce, telegramId, Date.now());
    if (result.changes === 0) return 'invalid';
    return this.find(nonce)?.status === 'authorized' ? 'authorized' : 'wrong';
  }

  deny(nonce: string): boolean {
    const result = this.database.connection
      .prepare(
        `UPDATE login_nonces SET status = 'denied'
          WHERE nonce = ? AND status IN ('pending', 'confirming') AND expires_at > ?`,
      )
      .run(nonce, Date.now());
    return result.changes > 0;
  }

  consume(nonce: string, bindingHash: string): NonceRecord | undefined {
    const db = this.database.connection;
    const result = db
      .prepare(
        `UPDATE login_nonces SET consumed_at = ?
          WHERE nonce = ? AND binding_hash = ? AND status = 'authorized'
            AND consumed_at IS NULL AND expires_at > ?`,
      )
      .run(Date.now(), nonce, bindingHash, Date.now());
    if (result.changes === 0) return undefined;
    return this.find(nonce);
  }

  purgeExpired(now = Date.now()): void {
    this.database.connection.prepare('DELETE FROM login_nonces WHERE expires_at <= ?').run(now);
  }
}
