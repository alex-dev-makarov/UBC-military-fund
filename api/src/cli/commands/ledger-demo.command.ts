import type { CliCommand } from '../command.types';
import { DEMO_LEDGER } from '../demo-ledger';
import { LedgerService } from '../../modules/ledger';
import { replaceLedgerFromSource } from './ledger-import.command';

/** Replaces the ledger with the fictional demo dataset. Refused outside local/dev. */
export const ledgerDemoCommand: CliCommand = {
  name: 'ledger:demo',
  usage: 'ledger:demo',
  precheck: (_args, env) =>
    env.APP_ENV === 'local' || env.APP_ENV === 'dev'
      ? null
      : `demo-дані заборонені для APP_ENV=${env.APP_ENV} — це затерло б реальний звіт`,
  run: async (app) => {
    replaceLedgerFromSource(app.get(LedgerService), DEMO_LEDGER);
  },
};
