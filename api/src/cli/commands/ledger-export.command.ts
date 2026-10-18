import type { CliCommand } from '../command.types';
import { LedgerService } from '../../modules/ledger';

/** Prints the private ledger as JSON on stdout. Nothing else may be written to stdout. */
export const ledgerExportCommand: CliCommand = {
  name: 'ledger:export',
  usage: 'ledger:export',
  readOnly: true,
  run: async (app) => {
    process.stdout.write(JSON.stringify(app.get(LedgerService).exportAll()));
  },
};
