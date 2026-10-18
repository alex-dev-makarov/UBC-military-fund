import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ENV_FILE_PATHS } from '../infra/config/env-files';
import { ledgerDemoCommand } from './commands/ledger-demo.command';
import { ledgerImportCommand } from './commands/ledger-import.command';
import { guardEnv, loadEnvFiles } from './env';

const KEYS = ['APP_ENV', 'D01_PROBE'];

describe('CLI env guards see env files', () => {
  const saved = KEYS.map((key) => [key, process.env[key]] as const);
  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function envFile(content: string): string {
    const path = join(mkdtempSync(join(tmpdir(), 'cli-env-')), '.env');
    writeFileSync(path, content);
    return path;
  }

  it('refuses ledger:import when APP_ENV=dev is only in an env file', () => {
    delete process.env.APP_ENV;
    loadEnvFiles([envFile('APP_ENV=dev\n')]);
    expect(ledgerImportCommand.precheck?.([], guardEnv(process.env))).toBe(
      'імпорт реальних даних на dev заборонений; для dev є demo',
    );
  });

  it('allows ledger:demo when APP_ENV=local is only in an env file', () => {
    delete process.env.APP_ENV;
    loadEnvFiles([envFile('APP_ENV=local\n')]);
    expect(ledgerDemoCommand.precheck?.([], guardEnv(process.env))).toBeNull();
  });

  it('does not override shell variables, and the first file wins', () => {
    process.env.APP_ENV = 'prod';
    delete process.env.D01_PROBE;
    loadEnvFiles([envFile('APP_ENV=dev\nD01_PROBE=first\n'), envFile('D01_PROBE=second\n'), '/nonexistent/.env']);
    expect(process.env.APP_ENV).toBe('prod');
    expect(process.env.D01_PROBE).toBe('first');
  });

  it('treats a missing APP_ENV as prod, like the old script message', () => {
    expect(ledgerDemoCommand.precheck?.([], guardEnv({}))).toBe(
      'demo-дані заборонені для APP_ENV=prod — це затерло б реальний звіт',
    );
  });

  it('resolves to api/.env.local then api/.env', () => {
    expect(ENV_FILE_PATHS.map((p) => p.split('/').slice(-2).join('/'))).toEqual(['api/.env.local', 'api/.env']);
  });
});
