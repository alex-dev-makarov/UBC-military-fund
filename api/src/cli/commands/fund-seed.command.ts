import type { CliCommand } from '../command.types';
import { FundService } from '../../modules/fund';

/** Seeds fund reference data if fund_meta is empty; otherwise reports that it was skipped. */
export const fundSeedCommand: CliCommand = {
  name: 'fund:seed',
  usage: 'fund:seed',
  run: async (app) => {
    const fund = app.get(FundService);
    if (!fund.seedIfEmpty()) {
      console.log('fund_meta вже має дані — сідер пропущено (це не помилка)');
      return;
    }
    const result = fund.getPublicFund();
    console.log(
      `засіяно: regions ${result.regions.length} · categories ${result.categories.length} ` +
        '(суми рахуються з private_expenses)',
    );
  },
};
