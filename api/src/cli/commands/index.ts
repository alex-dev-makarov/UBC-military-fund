import type { CliCommand } from '../command.types';
import { dbStatsCommand } from './db-stats.command';
import { fundSeedCommand } from './fund-seed.command';
import { ledgerDemoCommand } from './ledger-demo.command';
import { ledgerExportCommand } from './ledger-export.command';
import { ledgerImportCommand } from './ledger-import.command';
import { reportViewsCommand } from './report-views.command';

const COMMANDS: readonly CliCommand[] = [
  ledgerExportCommand,
  ledgerImportCommand,
  ledgerDemoCommand,
  fundSeedCommand,
  reportViewsCommand,
  dbStatsCommand,
];

export function findCommand(name: string): CliCommand | undefined {
  return COMMANDS.find((command) => command.name === name);
}

export function commandUsage(): string {
  return [
    'використання: pnpm --filter api cli <команда> [аргументи]',
    'команди:',
    ...COMMANDS.map((command) => `  ${command.usage}`),
  ].join('\n');
}
