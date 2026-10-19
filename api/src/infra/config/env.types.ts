export interface ValidatedEnv {
  APP_ENV: 'local' | 'dev' | 'prod';
  PORT: number;
  FRONTEND_ORIGIN?: string;
  PUBLIC_SITE_URL: string;
  ALLOWED_ORIGINS: string[];
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  JWT_EXPIRES_MS: number;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  ADMIN_TELEGRAM_IDS: number[];
  GOOGLE: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    sheetId: string;
    sheetGid: number;
    receiptsFolderId: string;
    photosFolderId: string;
  } | null;
  COOKIE_NAME: string;
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none';
  COOKIE_SECURE: boolean;
  COOKIE_DOMAIN?: string;
  DATABASE_PATH: string;
  TELEGRAM_BOT_POLLING: boolean;
  LOGIN_NONCE_TTL_SEC: number;
  HANDOFF_TTL_SEC: number;
  VIEW_LOG_RETENTION_DAYS: number;
  MEMBERSHIP_TTL_SEC: number;
}
