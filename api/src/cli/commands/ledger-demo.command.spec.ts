import { describe, expect, it, vi } from 'vitest';
import { LedgerService } from '../../modules/ledger';
import { DEMO_LEDGER } from '../demo-ledger';
import { fakeApp } from '../test-app';
import { ledgerDemoCommand } from './ledger-demo.command';

describe('ledger:demo', () => {
  const { precheck } = ledgerDemoCommand;

  it.each(['local', 'dev'])('is allowed for APP_ENV=%s', (appEnv) => {
    expect(precheck?.([], { APP_ENV: appEnv })).toBeNull();
  });

  it.each([
    [{ APP_ENV: 'prod' }, 'demo-дані заборонені для APP_ENV=prod — це затерло б реальний звіт'],
  ])('refuses %j with the old message', (env, message) => {
    expect(precheck?.([], env)).toBe(message);
  });

  it('replaces the ledger with the demo dataset and prints the summary to stderr', async () => {
    const ledger = {
      replaceAll: vi.fn(() => ({ years: 2, expenses: 9 })),
      getReport: vi.fn(() => ({ people: [{}, {}], total: 137970 })),
      countUncategorized: vi.fn(() => 0),
    };
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    await ledgerDemoCommand.run(fakeApp(new Map([[LedgerService, ledger]])), []);

    expect(ledger.replaceAll).toHaveBeenCalledWith(DEMO_LEDGER);
    expect(stderr).toHaveBeenCalledWith('імпортовано: років 2 · витрат 9 · людей 2 · разом 137970.00 ₴');
    expect(stderr).toHaveBeenCalledTimes(1);
  });
});
