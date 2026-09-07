import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';
import type { UserRecord } from '../model/types';

@Injectable()
export class UserRepository {
  constructor(private readonly database: DatabaseService) {}

  recordLogin(telegramId: number): void {
    const now = Date.now();
    this.database.connection
      .prepare(
        `INSERT INTO users (telegram_id, first_seen_at, last_login_at)
         VALUES (?, ?, ?)
         ON CONFLICT (telegram_id) DO UPDATE SET
           last_login_at = excluded.last_login_at`,
      )
      .run(telegramId, now, now);
  }

  setMembership(telegramId: number, isMember: boolean): void {
    const now = Date.now();
    this.database.connection
      .prepare(
        `INSERT INTO users (
           telegram_id, first_seen_at, last_login_at,
           is_member, membership_checked_at
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (telegram_id) DO UPDATE SET
           is_member = excluded.is_member,
           membership_checked_at = excluded.membership_checked_at`,
      )
      .run(telegramId, now, now, isMember ? 1 : 0, now);
  }

  findById(telegramId: number): UserRecord | undefined {
    return this.database.connection
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .get(telegramId) as UserRecord | undefined;
  }
}
