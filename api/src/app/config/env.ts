import type { ValidatedEnv } from '../../shared/config/env.types';

export type { ValidatedEnv };

const toOrigin = (url: string) => new URL(url.trim()).origin;

export function validate(raw: Record<string, string | undefined>): ValidatedEnv {
  const appEnv = (raw.APP_ENV ?? 'prod') as ValidatedEnv['APP_ENV'];
  const local = appEnv === 'local';

  const site = toOrigin(raw.PUBLIC_SITE_URL ?? '');
  const extra = (raw.FRONTEND_ORIGIN ?? '').split(',').filter((o) => o.trim()).map(toOrigin);

  return {
    APP_ENV: appEnv,
    PORT: Number(raw.PORT ?? 3000),
    PUBLIC_SITE_URL: site,
    FRONTEND_ORIGIN: extra.join(','),
    ALLOWED_ORIGINS: [...new Set([site, ...extra])],
    JWT_SECRET: raw.JWT_SECRET ?? '',
    JWT_EXPIRES_IN: local ? '2h' : '15m',
    JWT_EXPIRES_MS: local ? 2 * 60 * 60_000 : 15 * 60_000,
    TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN ?? '',
    TELEGRAM_CHAT_ID: raw.TELEGRAM_CHAT_ID ?? '',
    TELEGRAM_BOT_POLLING: raw.TELEGRAM_BOT_POLLING !== 'false',
    COOKIE_NAME: local ? 'ubc_session' : '__Host-ubc_session',
    COOKIE_SAMESITE: 'lax',
    COOKIE_SECURE: !local,
    COOKIE_DOMAIN: '',
    DATABASE_PATH: raw.DATABASE_PATH ?? './data/ubc.sqlite',
    LOGIN_NONCE_TTL_SEC: 300,
    HANDOFF_TTL_SEC: 120,
    VIEW_LOG_RETENTION_DAYS: 180,
    MEMBERSHIP_TTL_SEC: 0,
  };
}
