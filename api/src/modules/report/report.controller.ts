import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { JwtAuthGuard } from '../../shared/auth';
import { RateLimit, RateLimitGuard, clientIp } from '../../shared/http';
import { ChannelMemberGuard, SessionValidGuard } from '../../entities/user';
import type { PublicFund } from '../fund';
import type { JarBalance } from '../../integrations/monobank';
import type { PrivateReportView } from '../ledger';
import { ReportService } from './report.service';

@Controller('report')
export class ReportController {
  constructor(
    private readonly report: ReportService,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  @Get('public')
  @UseGuards(RateLimitGuard)
  @RateLimit(120, 60_000)
  getPublicReport(): PublicFund {
    return this.report.getPublic();
  }

  @Get('jar')
  @UseGuards(RateLimitGuard)
  @RateLimit(120, 60_000)
  getJarBalance(): Promise<JarBalance> {
    return this.report.getJar();
  }

  @Get('rate')
  @UseGuards(RateLimitGuard)
  @RateLimit(120, 60_000)
  getUsdRate(): Promise<{ usdRate: number | null }> {
    return this.report.getRate();
  }

  @Get('secret')
  @UseGuards(JwtAuthGuard, SessionValidGuard, RateLimitGuard, ChannelMemberGuard)
  @RateLimit(30, 60_000, 'user')
  getSecretReport(@Req() req: Request): PrivateReportView {
    const telegramId = req.user!.sub;
    const now = Date.now();
    const ip = clientIp(req, this.config.get('APP_ENV', { infer: true }) !== 'local');
    return this.report.getSecret(telegramId, now, ip, req.headers['user-agent']);
  }
}
