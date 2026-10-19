import type { INestApplicationContext } from '@nestjs/common';

export interface CliCommand {
  readonly name: string;
  /** Command never writes the working database: boot opens it read-only, skips migrations and retention. */
  readonly readOnly?: boolean;
  /** Shown in the usage message, e.g. `report:views [днів]`. */
  readonly usage: string;

  readonly precheck?: (args: readonly string[], env: NodeJS.ProcessEnv) => string | null;
  readonly run: (app: INestApplicationContext, args: readonly string[]) => Promise<void>;
}
