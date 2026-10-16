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
    ADMIN_TELEGRAM_IDS: (raw.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0),
    TELEGRAM_BOT_POLLING: raw.TELEGRAM_BOT_POLLING !== 'false',
    GOOGLE:
      raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET && raw.GOOGLE_REFRESH_TOKEN && raw.GOOGLE_SHEET_ID
        ? {
            clientId: raw.GOOGLE_CLIENT_ID,
            clientSecret: raw.GOOGLE_CLIENT_SECRET,
            refreshToken: raw.GOOGLE_REFRESH_TOKEN,
            sheetId: raw.GOOGLE_SHEET_ID,
            sheetGid: Number(raw.GOOGLE_SHEET_GID ?? 0),
            receiptsFolderId: raw.GOOGLE_RECEIPTS_FOLDER_ID ?? '',
            photosFolderId: raw.GOOGLE_PHOTOS_FOLDER_ID ?? '',
          }
        : null,
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
