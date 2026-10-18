import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FundRepository } from '../fund';
import type { LedgerRepository, ViewLogRepository } from '../ledger';
import type { JarBalanceClient } from '../../integrations/monobank';
import type { UsdRateClient } from '../../integrations/nbu';
import type { SecurityLogService } from '../../shared/log';
import { ReportService } from './report.service';

const TELEGRAM_ID = 111;
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const IP = '203.0.113.7';
const UA = 'vitest-agent';
const REPORT = { expenses: [], years: [] };

describe('ReportService', () => {
  let fund: { getPublicFund: ReturnType<typeof vi.fn>; getMeta: ReturnType<typeof vi.fn> };
  let jar: { get: ReturnType<typeof vi.fn> };
  let usd: { get: ReturnType<typeof vi.fn> };
  let ledger: { getReport: ReturnType<typeof vi.fn> };
  let views: { record: ReturnType<typeof vi.fn> };
  let securityLog: { record: ReturnType<typeof vi.fn> };
  let service: ReportService;

  beforeEach(() => {
    fund = { getPublicFund: vi.fn(() => ({ title: 'public' })), getMeta: vi.fn(() => 'https://send.monobank.ua/jar/abc') };
    jar = { get: vi.fn(async () => ({ amount: 1, name: 'jar' })) };
    usd = { get: vi.fn(async () => 41.5) };
    ledger = { getReport: vi.fn(() => REPORT) };
    views = { record: vi.fn(() => true) };
    securityLog = { record: vi.fn() };
    service = new ReportService(
      fund as unknown as FundRepository,
      jar as unknown as JarBalanceClient,
      usd as unknown as UsdRateClient,
      ledger as unknown as LedgerRepository,
      views as unknown as ViewLogRepository,
      securityLog as unknown as SecurityLogService,
    );
  });

  it('getPublic delegates to the fund repository', () => {
    expect(service.getPublic()).toEqual({ title: 'public' });
    expect(fund.getPublicFund).toHaveBeenCalledTimes(1);
  });

  it('getJar passes a lazy jarUrl getter to the client', async () => {
    expect(await service.getJar()).toEqual({ amount: 1, name: 'jar' });
    expect(fund.getMeta).not.toHaveBeenCalled();

    const getter = jar.get.mock.calls[0][0] as () => string | null;
    expect(getter()).toBe('https://send.monobank.ua/jar/abc');
    expect(fund.getMeta).toHaveBeenCalledWith('jarUrl');
  });

  it('getRate wraps the USD rate', async () => {
    expect(await service.getRate()).toEqual({ usdRate: 41.5 });
  });

  it('getSecret records the view and logs it when the view is new', () => {
    const result = service.getSecret(TELEGRAM_ID, NOW, IP, UA);

    expect(views.record).toHaveBeenCalledWith(TELEGRAM_ID, NOW, IP, UA);
    expect(securityLog.record).toHaveBeenCalledWith('report.view', { telegram_id: TELEGRAM_ID, ip: IP });
    expect(result).toEqual({
      ...REPORT,
      viewer: { telegramId: TELEGRAM_ID, viewedAt: new Date(NOW).toISOString() },
    });
  });

  it('getSecret skips the security log when the view is a duplicate', () => {
    views.record.mockReturnValue(false);

    const result = service.getSecret(TELEGRAM_ID, NOW, IP, UA);

    expect(securityLog.record).not.toHaveBeenCalled();
    expect(result.viewer).toEqual({ telegramId: TELEGRAM_ID, viewedAt: new Date(NOW).toISOString() });
  });
});
