import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { SecurityLogService } from '../../shared/log';
import { ViewLogRepository } from './view-log.repository';

const DAY_MS = 86_400_000;

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly views: ViewLogRepository,
    private readonly securityLog: SecurityLogService,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  onModuleInit(): void {
    this.purge();
    this.timer = setInterval(() => this.purge(), DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  purge(now = Date.now()): void {
    const days = this.config.get('VIEW_LOG_RETENTION_DAYS', { infer: true });
    const before = now - days * DAY_MS;
    const views = this.views.purgeBefore(before);
    const events = this.securityLog.purgeBefore(before);
    if (views + events > 0) {
      this.logger.log(`retention: removed ${views} views and ${events} security events older than ${days} days`);
    }
  }
}
