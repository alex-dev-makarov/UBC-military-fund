import { Injectable } from '@nestjs/common';
import { SecurityLogRepository } from './security-log.repository';
import type { SecurityEvent } from './security-log.types';

@Injectable()
export class SecurityLogService {
  constructor(private readonly repository: SecurityLogRepository) {}

  record(event: SecurityEvent, fields: Record<string, unknown> = {}): void {
    const ts = Date.now();
    process.stdout.write(`${JSON.stringify({ ts: new Date(ts).toISOString(), event, ...fields })}\n`);
    this.repository.insert(ts, event, JSON.stringify(fields));
  }

  purgeBefore(before: number): number {
    return this.repository.purgeBefore(before);
  }
}
