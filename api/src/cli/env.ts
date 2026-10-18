import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { VALIDATED_ENV_KEYS } from '../infra/config/env';

/**
 * Loads env files the way ConfigModule does (first file wins, shell variables are never overridden),
 * but only keys validate() reads — unvalidated keys in the files must not reach the CLI process.
 * The CLI guards run before AppModule is created, so they need the same view of APP_ENV that the
 * old private.mjs got after AppModule loaded.
 */
export function loadEnvFiles(paths: readonly string[]): void {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
      if (VALIDATED_ENV_KEYS.includes(key) && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

/** Env as seen by precheck: a missing APP_ENV means 'prod', like validate() in infra/config/env.ts. */
export function guardEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, APP_ENV: env.APP_ENV ?? 'prod' };
}
