import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db';

export type SecurityEvent =
  | 'auth.start'
  | 'auth.confirm_sent'
  | 'auth.not_member'
  | 'auth.wrong_code'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.bad_origin'
  | 'session.invalid'
  | 'session.revoked'
  | 'session.revoked_by_user'
  | 'report.view'
  | 'report.forbidden'
  | 'rate.limited';

@Injectable()
export class SecurityLogService {
  constructor(private readonly database: DatabaseService) {}

  record(event: SecurityEvent, fields: Record<string, unknown> = {}): void {
    const ts = Date.now();
    process.stdout.write(`${JSON.stringify({ ts: new Date(ts).toISOString(), event, ...fields })}\n`);
    this.database.connection
      .prepare('INSERT INTO security_events (ts, event, data) VALUES (?, ?, ?)')
      .run(ts, event, JSON.stringify(fields));
  }

  purgeBefore(before: number): number {
    return Number(
      this.database.connection.prepare('DELETE FROM security_events WHERE ts < ?').run(before).changes,
    );
  }
}
