export interface ValidatedEnv {
  PORT: number;
  AUTH_MAX_AGE_SEC: number;
  FRONTEND_ORIGIN?: string;
  PUBLIC_SITE_URL: string;
  ALLOWED_ORIGINS: string[];
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  JWT_EXPIRES_MS: number;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  COOKIE_NAME?: string;
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none';
  COOKIE_SECURE: boolean;
  COOKIE_DOMAIN?: string;
  DATABASE_PATH: string;
  TELEGRAM_BOT_POLLING: boolean;
  LOGIN_NONCE_TTL_SEC: number;
  MEMBERSHIP_TTL_SEC: number;
}
