import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/db';
import type { SecurityEvent } from './security-log.types';

@Injectable()
export class SecurityLogRepository {
  constructor(private readonly database: DatabaseService) {}

  insert(ts: number, event: SecurityEvent, data: string): void {
    this.database.connection
      .prepare('INSERT INTO security_events (ts, event, data) VALUES (?, ?, ?)')
      .run(ts, event, data);
  }

  purgeBefore(before: number): number {
    return Number(
      this.database.connection.prepare('DELETE FROM security_events WHERE ts < ?').run(before).changes,
    );
  }
}
