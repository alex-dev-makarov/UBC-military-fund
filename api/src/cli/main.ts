import 'reflect-metadata';
import type { INestApplicationContext } from '@nestjs/common';

// Must run before AppModule is loaded: ConfigModule.forRoot validates env at module evaluation,
// and the CLI must never start the Telegram poller. AppModule is therefore imported dynamically below.
process.env.TELEGRAM_BOT_POLLING = 'false';

async function createContext(): Promise<INestApplicationContext> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../app/app.module');
  // DatabaseService logs applied migrations with console.log while booting. Route that to stderr
  // so stdout carries only command output (ledger:export must stay pipe-clean).
  const stdoutLog = console.log;
  console.log = console.error;
  try {
    return await NestFactory.createApplicationContext(AppModule, { logger: false });
  } finally {
    console.log = stdoutLog;
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const { findCommand, commandUsage } = await import('./commands');
  const [name, ...args] = argv;
  const command = name === undefined ? undefined : findCommand(name);
  if (!command) {
    console.error(commandUsage());
    return 1;
  }

  // Guards must see APP_ENV from api/.env.local / api/.env, as ConfigModule would load them.
  const { ENV_FILE_PATHS } = await import('../infra/config/env-files');
  const { loadEnvFiles, guardEnv } = await import('./env');
  loadEnvFiles(ENV_FILE_PATHS);

  const refusal = command.precheck?.(args, guardEnv(process.env));
  if (refusal) {
    console.error(refusal);
    return 1;
  }

  // Decided before AppModule is loaded: DatabaseService and RetentionService check it on init.
  // An inherited shell value is cleared for write commands.
  const { applyReadOnlyMode } = await import('./read-only-mode');
  applyReadOnlyMode(process.env, command);

  const app = await createContext();
  try {
    await command.run(app, args);
    return 0;
  } finally {
    await app.close();
  }
}

// exitCode rather than process.exit: stdout (export JSON) must be fully flushed when piped.
main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
