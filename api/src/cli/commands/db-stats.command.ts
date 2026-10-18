import type { CliCommand } from '../command.types';
import { DatabaseService } from '../../infra/db';

/** Row counts per table. Boots read-only (readOnly flag); SQL lives in DatabaseService.tableCounts. */
export const dbStatsCommand: CliCommand = {
  name: 'db:stats',
  usage: 'db:stats',
  readOnly: true,
  run: async (app) => {
    console.log('таблиці:');
    for (const { name, count } of app.get(DatabaseService).tableCounts()) {
      console.log('  ' + name.padEnd(20) + count);
    }
    console.log('\nдля SQL-запитів використовуйте sqlite3 на копії бази, а не на робочому файлі');
  },
};
