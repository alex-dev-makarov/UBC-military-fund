import type { CliCommand } from '../command.types';
import { LedgerService, type LedgerImport } from '../../modules/ledger';

/** Replaces the ledger with `source` and prints the summary to stderr (shared with ledger:demo). */
export function replaceLedgerFromSource(ledger: LedgerService, source: LedgerImport): void {
  const result = ledger.replaceAll(source);
  const report = ledger.getReport();
  console.error(
    `імпортовано: років ${result.years} · витрат ${result.expenses} · людей ${report.people.length} · ` +
      `разом ${report.total.toFixed(2)} ₴`,
  );
  const uncategorized = ledger.countUncategorized();
  if (uncategorized > 0) {
    console.error(`увага: ${uncategorized} витрат без відомої категорії — у публічному звіті вони підуть в «Інше»`);
  }
}

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

/** Reads ledger JSON from stdin and replaces the whole ledger with it. */
export const ledgerImportCommand: CliCommand = {
  name: 'ledger:import',
  usage: 'ledger:import  (JSON на stdin)',
  precheck: (_args, env) =>
    env.APP_ENV === 'dev' ? 'імпорт реальних даних на dev заборонений; для dev є demo' : null,
  run: async (app) => {
    // Shape is validated by LedgerRepository.replaceAll, which throws on bad input.
    const source = JSON.parse(await readStdin()) as LedgerImport;
    replaceLedgerFromSource(app.get(LedgerService), source);
  },
};
