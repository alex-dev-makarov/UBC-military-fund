import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FundRepository } from '../fund';
import type { LedgerRepository, ViewLogRepository } from '../ledger';
import type { JarBalanceClient } from '../../integrations/monobank';
import type { UsdRateClient } from '../../integrations/nbu';
import type { SecurityLogService } from '../security-log';
import { ReportService } from './report.service';

const TELEGRAM_ID = 111;
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const IP = '203.0.113.7';
const UA = 'vitest-agent';
const REPORT = { generatedAt: null, total: 0, people: [], expenses: [], years: [] };
const EMPTY_DERIVED = {
  allReceipts: true,
  itemized: { years: [], total: 0, count: 0, average: 0, lastYear: null },
  monthly: [{ month: 1, total: 0, count: 0 }],
  monthlyByPerson: {},
};
const PUBLIC_FUND = {
  title: 'public',
  years: [{ year: '2025', amount: 40 }],
  categories: [{ name: { uk: 'Інше', en: 'Other' }, amount: 40, color: '#000' }],
  months: [[1, 10], [2, 30]],
};

describe('ReportService', () => {
  let fund: { getPublicFund: ReturnType<typeof vi.fn>; getMeta: ReturnType<typeof vi.fn> };
  let jar: { get: ReturnType<typeof vi.fn> };
  let usd: { get: ReturnType<typeof vi.fn> };
  let ledger: { getReport: ReturnType<typeof vi.fn> };
  let views: { record: ReturnType<typeof vi.fn> };
  let securityLog: { record: ReturnType<typeof vi.fn> };
  let service: ReportService;

  beforeEach(() => {
    fund = { getPublicFund: vi.fn(() => PUBLIC_FUND), getMeta: vi.fn(() => 'https://send.monobank.ua/jar/abc') };
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

  it('getPublic delegates to the fund repository and adds the summary', () => {
    expect(service.getPublic()).toEqual({
      ...PUBLIC_FUND,
      summary: { totalSpent: 40, categoriesTotal: 40, peakMonth: [2, 30] },
    });
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
      derived: EMPTY_DERIVED,
    });
  });

  it('getSecret skips the security log when the view is a duplicate', () => {
    views.record.mockReturnValue(false);

    const result = service.getSecret(TELEGRAM_ID, NOW, IP, UA);

    expect(securityLog.record).not.toHaveBeenCalled();
    expect(result.viewer).toEqual({ telegramId: TELEGRAM_ID, viewedAt: new Date(NOW).toISOString() });
  });

  it('getSecret derives itemized totals and monthly series from the ledger', () => {
    ledger.getReport.mockReturnValue({
      generatedAt: '2026-10-11',
      total: 30,
      people: [{ name: 'Ann', total: 30, count: 2 }],
      years: [{ year: 2025, total: 30, count: 2, summarized: false, hasReceipt: true }],
      expenses: [
        { id: 2, date: '2025-03-02', item: 'B', person: 'Ann', note: null, price: 20, delivery: 0, commission: 0, total: 20, hasReceipt: true },
        { id: 1, date: '2025-01-15', item: 'A', person: 'Ann', note: null, price: 10, delivery: 0, commission: 0, total: 10, hasReceipt: true },
      ],
    });

    const result = service.getSecret(TELEGRAM_ID, NOW, IP, UA);

    expect(result.derived).toEqual({
      allReceipts: true,
      itemized: { years: [2025], total: 30, count: 2, average: 15, lastYear: 2025 },
      monthly: [
        { month: 1, total: 10, count: 1 },
        { month: 2, total: 0, count: 0 },
        { month: 3, total: 20, count: 1 },
      ],
      monthlyByPerson: {
        Ann: [
          { month: 1, total: 10, count: 1 },
          { month: 2, total: 0, count: 0 },
          { month: 3, total: 20, count: 1 },
        ],
      },
    });
  });
});
