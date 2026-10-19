import { join } from 'node:path';

/** Env files in precedence order (first wins): api/.env.local, then api/.env. Shared by AppModule and the CLI. */
export const ENV_FILE_PATHS: readonly string[] = [
  join(__dirname, '..', '..', '..', '.env.local'),
  join(__dirname, '..', '..', '..', '.env'),
];
