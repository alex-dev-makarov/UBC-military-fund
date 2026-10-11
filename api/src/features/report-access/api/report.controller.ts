import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import { JwtAuthGuard } from '../../../shared/auth';
import { RateLimit, RateLimitGuard, clientIp } from '../../../shared/http';
import { SecurityLogService } from '../../../shared/log';
import { ChannelMemberGuard, SessionValidGuard } from '../../../entities/user';
import { FundRepository, type PublicFund } from '../../../entities/fund';
import { LedgerRepository, ViewLogRepository, type PrivateReportView } from '../../../entities/report';

@Controller('report')
export class ReportController {
  constructor(
    private readonly securityLog: SecurityLogService,
    private readonly fund: FundRepository,
    private readonly ledger: LedgerRepository,
    private readonly views: ViewLogRepository,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  @Get('public')
  @UseGuards(RateLimitGuard)
  @RateLimit(120, 60_000)
  getPublicReport(): PublicFund {
    return this.fund.getPublicFund();
  }

  @Get('secret')
  @UseGuards(JwtAuthGuard, SessionValidGuard, RateLimitGuard, ChannelMemberGuard)
  @RateLimit(30, 60_000, 'user')
  getSecretReport(@Req() req: Request): PrivateReportView {
    const telegramId = req.user!.sub;
    const now = Date.now();
    const ip = clientIp(req, this.config.get('APP_ENV', { infer: true }) !== 'local');
    if (this.views.record(telegramId, now, ip, req.headers['user-agent'])) {
      this.securityLog.record('report.view', { telegram_id: telegramId, ip });
    }
    return {
      ...this.ledger.getReport(),
      viewer: { telegramId, viewedAt: new Date(now).toISOString() },
    };
  }
}
