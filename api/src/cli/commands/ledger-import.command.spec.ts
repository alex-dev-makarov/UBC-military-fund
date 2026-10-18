import { describe, expect, it, vi } from 'vitest';
import { LedgerService } from '../../modules/ledger';
import { fakeApp } from '../test-app';
import { ledgerImportCommand, replaceLedgerFromSource } from './ledger-import.command';

const SOURCE = { expenses: [] };

describe('ledger:import', () => {
  it('is refused on APP_ENV=dev before any database work', () => {
    expect(ledgerImportCommand.precheck?.([], { APP_ENV: 'dev' })).toBe(
      'імпорт реальних даних на dev заборонений; для dev є demo',
    );
  });

  it.each([{ APP_ENV: 'local' }, { APP_ENV: 'prod' }, {}])('is allowed for %j', (env) => {
    expect(ledgerImportCommand.precheck?.([], env)).toBeNull();
  });

  it('prints the summary and the uncategorized warning to stderr', () => {
    const ledger = {
      replaceAll: vi.fn(() => ({ years: 1, expenses: 3 })),
      getReport: vi.fn(() => ({ people: [{}], total: 10.5 })),
      countUncategorized: vi.fn(() => 2),
    };
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    replaceLedgerFromSource(ledger as unknown as LedgerService, SOURCE);

    expect(ledger.replaceAll).toHaveBeenCalledWith(SOURCE);
    expect(stderr.mock.calls).toEqual([
      ['імпортовано: років 1 · витрат 3 · людей 1 · разом 10.50 ₴'],
      ['увага: 2 витрат без відомої категорії — у публічному звіті вони підуть в «Інше»'],
    ]);
  });

  it('omits the warning when every expense is categorized', () => {
    const ledger = {
      replaceAll: vi.fn(() => ({ years: 0, expenses: 0 })),
      getReport: vi.fn(() => ({ people: [], total: 0 })),
      countUncategorized: vi.fn(() => 0),
    };
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    replaceLedgerFromSource(ledger as unknown as LedgerService, SOURCE);

    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it('run() replaces the ledger with the parsed source', async () => {
    const ledger = {
      replaceAll: vi.fn(() => ({ years: 0, expenses: 0 })),
      getReport: vi.fn(() => ({ people: [], total: 0 })),
      countUncategorized: vi.fn(() => 0),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdin = Object.assign([Buffer.from(JSON.stringify(SOURCE))], {});
    const original = Object.getOwnPropertyDescriptor(process, 'stdin');
    Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });
    try {
      await ledgerImportCommand.run(fakeApp(new Map([[LedgerService, ledger]])), []);
    } finally {
      if (original) Object.defineProperty(process, 'stdin', original);
    }

    expect(ledger.replaceAll).toHaveBeenCalledWith(SOURCE);
  });
});
