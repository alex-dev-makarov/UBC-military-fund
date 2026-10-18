import { describe, expect, it } from 'vitest';
import { VALIDATED_ENV_KEYS, validate } from './env';

const base = {
  APP_ENV: 'local',
  PUBLIC_SITE_URL: 'http://localhost:5173',
  JWT_SECRET: 'x'.repeat(40),
  TELEGRAM_BOT_TOKEN: '1:token',
  TELEGRAM_CHAT_ID: '-100',
};

const prod = { ...base, APP_ENV: 'prod', PUBLIC_SITE_URL: 'https://site.example' };

describe('config', () => {
  it('uses secure cookies and short sessions outside local', () => {
    const env = validate(prod);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.COOKIE_NAME).toBe('__Host-ubc_session');
    expect(env.JWT_EXPIRES_MS).toBe(15 * 60_000);
  });

  it('uses a plain cookie locally', () => {
    const env = validate(base);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.COOKIE_NAME).toBe('ubc_session');
  });

  it('treats a missing APP_ENV as prod', () => {
    expect(validate({ ...prod, APP_ENV: undefined }).COOKIE_SECURE).toBe(true);
  });

  it('always allows the public site plus every FRONTEND_ORIGIN entry, as bare origins', () => {
    const env = validate({ ...prod, PUBLIC_SITE_URL: 'https://site.example/', FRONTEND_ORIGIN: ' https://www.site.example/ ,' });
    expect(env.PUBLIC_SITE_URL).toBe('https://site.example');
    expect(env.ALLOWED_ORIGINS).toEqual(['https://site.example', 'https://www.site.example']);
  });

  it('keeps the bot on unless switched off', () => {
    expect(validate(base).TELEGRAM_BOT_POLLING).toBe(true);
    expect(validate({ ...base, TELEGRAM_BOT_POLLING: 'false' }).TELEGRAM_BOT_POLLING).toBe(false);
  });

  it('keeps VALIDATED_ENV_KEYS in sync with the keys validate() reads', () => {
    const input: Record<string, string> = {
      ...base,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REFRESH_TOKEN: 'refresh',
      GOOGLE_SHEET_ID: 'sheet',
    };
    const seen: string[] = [];
    const spy = new Proxy(input, {
      get(target, key, receiver) {
        if (typeof key === 'string') seen.push(key);
        return Reflect.get(target, key, receiver);
      },
    });
    validate(spy);
    expect(new Set(seen)).toEqual(new Set(VALIDATED_ENV_KEYS));
  });
});
