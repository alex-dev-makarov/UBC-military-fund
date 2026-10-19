import { Injectable } from '@nestjs/common';
import { FundRepository } from '../fund';
import { LedgerRepository, ViewLogRepository } from '../ledger';
import { JarBalanceClient, type JarBalance } from '../../integrations/monobank';
import { UsdRateClient } from '../../integrations/nbu';
import { SecurityLogService } from '../security-log';
import { derivePrivateReport, summarizePublicFund } from './report.math';
import type { PublicFundReport, SecretReportView } from './report.types';

export type { JarBalance };

@Injectable()
export class ReportService {
  constructor(
    private readonly fund: FundRepository,
    private readonly jar: JarBalanceClient,
    private readonly usd: UsdRateClient,
    private readonly ledger: LedgerRepository,
    private readonly views: ViewLogRepository,
    private readonly securityLog: SecurityLogService,
  ) {}

  getPublic(): PublicFundReport {
    const fund = this.fund.getPublicFund();
    return { ...fund, summary: summarizePublicFund(fund) };
  }

  getJar(): Promise<JarBalance> {
    return this.jar.get(() => this.fund.getMeta('jarUrl'));
  }

  async getRate(): Promise<{ usdRate: number | null }> {
    return { usdRate: await this.usd.get() };
  }

  getSecret(telegramId: number, now: number, ip: string | undefined, userAgent: string | undefined): SecretReportView {
    if (this.views.record(telegramId, now, ip, userAgent)) {
      this.securityLog.record('report.view', { telegram_id: telegramId, ip });
    }
    const report = this.ledger.getReport();
    return {
      ...report,
      viewer: { telegramId, viewedAt: new Date(now).toISOString() },
      derived: derivePrivateReport(report),
    };
  }
}
