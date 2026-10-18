import { existsSync } from 'node:fs';

/**
 * Loads env files the way ConfigModule does (first file wins, shell variables are never overridden;
 * process.loadEnvFile keeps already-set vars). The CLI guards run before AppModule is created,
 * so they need the same view of APP_ENV that the old private.mjs got after AppModule loaded.
 */
export function loadEnvFiles(
  paths: readonly string[],
  load: (path: string) => void = (path) => process.loadEnvFile(path),
): void {
  for (const path of paths) {
    if (existsSync(path)) load(path);
  }
}

/** Env as seen by precheck: a missing APP_ENV means 'prod', like validate() in infra/config/env.ts. */
export function guardEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, APP_ENV: env.APP_ENV ?? 'prod' };
}
