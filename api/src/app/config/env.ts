import type { ValidatedEnv } from '../../shared/config/env.types';

interface RawEnv {
  [key: string]: string | undefined;
}

export type { ValidatedEnv };

function toNumber(name: string, raw: string | undefined, fallback: number, max?: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`Environment variable ${name} must be at most ${max}, got: ${raw}`);
  }
  return value;
}

function requireString(name: string, raw: string | undefined): string {
  if (raw === undefined || raw === '') {
    throw new Error(`Environment variable ${name} is required and must be a non-empty string`);
  }
  return raw;
}

function toBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  throw new Error(`Environment variable ${name} must be a boolean-like value (true/false/1/0/yes/no), got: ${raw}`);
}

export function validate(config: RawEnv): ValidatedEnv {
  const validated: Record<string, unknown> = { ...config };
  validated.PORT = toNumber('PORT', config.PORT, 3000, 65535);
  validated.AUTH_MAX_AGE_SEC = toNumber('AUTH_MAX_AGE_SEC', config.AUTH_MAX_AGE_SEC, 60, 3600);

  const jwtSecret = requireString('JWT_SECRET', config.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error(
      `Environment variable JWT_SECRET must be at least 32 characters (got ${jwtSecret.length}). ` +
        'Generate one with: openssl rand -base64 48',
    );
  }
  if (/^(change-me|secret|dev-only|test)/i.test(jwtSecret)) {
    throw new Error('Environment variable JWT_SECRET looks like a placeholder — generate a real one');
  }
  validated.JWT_SECRET = jwtSecret;

  const expiresIn = (config.JWT_EXPIRES_IN || '15m').trim();
  const expiresMatch = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!expiresMatch) {
    throw new Error(
      `Environment variable JWT_EXPIRES_IN must look like 15m / 2h / 7d, got: ${config.JWT_EXPIRES_IN}`,
    );
  }
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  validated.JWT_EXPIRES_IN = expiresIn;
  validated.JWT_EXPIRES_MS = Number(expiresMatch[1]) * unitMs[expiresMatch[2] as 's' | 'm' | 'h' | 'd'];
  validated.TELEGRAM_BOT_TOKEN = requireString('TELEGRAM_BOT_TOKEN', config.TELEGRAM_BOT_TOKEN);
  validated.TELEGRAM_CHAT_ID = requireString('TELEGRAM_CHAT_ID', config.TELEGRAM_CHAT_ID);

  const rawSameSite = (config.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (rawSameSite !== 'lax' && rawSameSite !== 'strict' && rawSameSite !== 'none') {
    throw new Error(`Environment variable COOKIE_SAMESITE must be one of 'lax', 'strict', 'none', got: ${config.COOKIE_SAMESITE}`);
  }
  validated.COOKIE_SAMESITE = rawSameSite as 'lax' | 'strict' | 'none';

  const secure = toBoolean('COOKIE_SECURE', config.COOKIE_SECURE, false);
  validated.COOKIE_SECURE = secure;

  if (rawSameSite === 'none' && !secure) {
    throw new Error('Environment variable configuration error: COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browser rule: SameSite=None requires Secure)');
  }

  validated.DATABASE_PATH = config.DATABASE_PATH || './data/ubc.sqlite';

  validated.TELEGRAM_BOT_POLLING = toBoolean('TELEGRAM_BOT_POLLING', config.TELEGRAM_BOT_POLLING, true);

  validated.LOGIN_NONCE_TTL_SEC = toNumber('LOGIN_NONCE_TTL_SEC', config.LOGIN_NONCE_TTL_SEC, 300, 3600);

  const membershipTtlRaw = (config.MEMBERSHIP_TTL_SEC ?? '').trim();
  if (membershipTtlRaw === '0') {
    validated.MEMBERSHIP_TTL_SEC = 0;
  } else {
    validated.MEMBERSHIP_TTL_SEC = toNumber('MEMBERSHIP_TTL_SEC', config.MEMBERSHIP_TTL_SEC, 60, 3600);
  }

  const originCandidates = (config.PUBLIC_SITE_URL || config.FRONTEND_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const publicSite =
    originCandidates.find((entry) => entry.startsWith('https://')) ?? originCandidates[0];
  if (!publicSite || !/^https?:\/\//.test(publicSite)) {
    throw new Error(
      'PUBLIC_SITE_URL must be a single origin including the scheme, e.g. https://example.com. ' +
        'It builds the bot link, so it cannot be a comma-separated list. ' +
        `Got: ${config.PUBLIC_SITE_URL || config.FRONTEND_ORIGIN || '(empty)'}`,
    );
  }
  validated.PUBLIC_SITE_URL = publicSite.replace(/\/+$/, '');

  const corsEntries = (config.FRONTEND_ORIGIN || '').split(',').map((entry) => entry.trim());
  validated.ALLOWED_ORIGINS = Array.from(
    new Set(
      [...corsEntries, ...originCandidates, validated.PUBLIC_SITE_URL as string]
        .map((entry) => entry.replace(/\/+$/, ''))
        .filter((entry) => /^https?:\/\//.test(entry)),
    ),
  );

  return validated as unknown as ValidatedEnv;
}
