import { Injectable } from '@nestjs/common';
import { FundRepository, type PublicFund } from '../fund';
import { LedgerRepository, ViewLogRepository, type PrivateReportView } from '../ledger';
import { JarBalanceClient, type JarBalance } from '../../integrations/monobank';
import { UsdRateClient } from '../../integrations/nbu';
import { SecurityLogService } from '../../shared/log';

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

  getPublic(): PublicFund {
    return this.fund.getPublicFund();
  }

  getJar(): Promise<JarBalance> {
    return this.jar.get(() => this.fund.getMeta('jarUrl'));
  }

  async getRate(): Promise<{ usdRate: number | null }> {
    return { usdRate: await this.usd.get() };
  }

  getSecret(telegramId: number, now: number, ip: string | undefined, userAgent: string | undefined): PrivateReportView {
    if (this.views.record(telegramId, now, ip, userAgent)) {
      this.securityLog.record('report.view', { telegram_id: telegramId, ip });
    }
    return {
      ...this.ledger.getReport(),
      viewer: { telegramId, viewedAt: new Date(now).toISOString() },
    };
  }
}
