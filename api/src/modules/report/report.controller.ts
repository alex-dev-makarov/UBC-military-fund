import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ValidatedEnv } from '../../infra/config/env.types';
import { JwtAuthGuard } from '../../infra/auth';
import { RateLimit, RateLimitGuard, clientIp } from '../../infra/http';
import { ChannelMemberGuard, SessionValidGuard } from '../user';
import { ReportService, type JarBalance } from './report.service';
import type { PublicFundReport, SecretReportView } from './report.types';

@Controller('report')
export class ReportController {
  constructor(
    private readonly report: ReportService,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  @Get('public')
  @UseGuards(RateLimitGuard)
  @RateLimit(120, 60_000)
  getPublicReport(): PublicFundReport {
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
  getSecretReport(@Req() req: Request): SecretReportView {
    const telegramId = req.user!.sub;
    const now = Date.now();
    const ip = clientIp(req, this.config.get('APP_ENV', { infer: true }) !== 'local');
    return this.report.getSecret(telegramId, now, ip, req.headers['user-agent']);
  }
}
