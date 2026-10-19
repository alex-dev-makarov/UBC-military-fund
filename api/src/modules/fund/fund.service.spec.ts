import { describe, expect, it, vi } from 'vitest';
import { FundService } from './fund.service';
import type { PublicFund } from './fund.types';

describe('FundService', () => {
  it('delegates seeding and the public read to FundRepository', () => {
    const fund = { regions: [] } as unknown as PublicFund; // fixture only; the service never reads its fields
    const repo = { seedIfEmpty: vi.fn(() => true), getPublicFund: vi.fn(() => fund) };
    const service = new FundService(repo as never);

    expect(service.seedIfEmpty()).toBe(true);
    expect(service.getPublicFund()).toBe(fund);
    expect(repo.seedIfEmpty).toHaveBeenCalledTimes(1);
    expect(repo.getPublicFund).toHaveBeenCalledTimes(1);
  });

  it('passes through false when the fund was already seeded', () => {
    const service = new FundService({ seedIfEmpty: () => false } as never);
    expect(service.seedIfEmpty()).toBe(false);
  });
});
