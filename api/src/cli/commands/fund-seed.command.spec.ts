import { describe, expect, it, vi } from 'vitest';
import { FundService } from '../../modules/fund';
import { fakeApp } from '../test-app';
import { fundSeedCommand } from './fund-seed.command';

describe('fund:seed', () => {
  it('reports the skip when fund_meta already has data', async () => {
    const fund = { seedIfEmpty: vi.fn(() => false), getPublicFund: vi.fn() };
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});

    await fundSeedCommand.run(fakeApp(new Map([[FundService, fund]])), []);

    expect(stdout).toHaveBeenCalledWith('fund_meta вже має дані — сідер пропущено (це не помилка)');
    expect(fund.getPublicFund).not.toHaveBeenCalled();
  });

  it('reports region and category counts after seeding', async () => {
    const fund = {
      seedIfEmpty: vi.fn(() => true),
      getPublicFund: vi.fn(() => ({ regions: [1, 2, 3], categories: [1, 2] })),
    };
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});

    await fundSeedCommand.run(fakeApp(new Map([[FundService, fund]])), []);

    expect(stdout).toHaveBeenCalledWith(
      'засіяно: regions 3 · categories 2 (суми рахуються з private_expenses)',
    );
  });
});
