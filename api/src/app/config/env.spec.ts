import { describe, expect, it } from 'vitest';
import { validate } from './env';

const base = {
  APP_ENV: 'local',
  JWT_SECRET: 'x'.repeat(40),
  TELEGRAM_BOT_TOKEN: '1:token',
  TELEGRAM_CHAT_ID: '-100',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

describe('validate: session lifetime', () => {
  it('defaults to 15 minutes', () => {
    const env = validate({ ...base });
    expect(env.JWT_EXPIRES_IN).toBe('15m');
    expect(env.JWT_EXPIRES_MS).toBe(900_000);
  });

  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
  ])('derives %s into milliseconds', (value, ms) => {
    
    
    expect(validate({ ...base, JWT_EXPIRES_IN: value }).JWT_EXPIRES_MS).toBe(ms);
  });

  it.each(['15minutes', '15', 'm15', '15 m', '-15m', '1.5h'])(
    'refuses to boot on %s',
    (value) => {
      expect(() => validate({ ...base, JWT_EXPIRES_IN: value })).toThrow(/JWT_EXPIRES_IN/);
    },
  );
});

describe('validate: JWT_SECRET strength', () => {
  it('rejects a short secret', () => {
    expect(() => validate({ ...base, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it.each(['dev-only-not-a-real-secret-padded-out-to-32', 'change-me-but-long-enough-to-pass-32x', 'test'.repeat(9)])(
    'rejects the placeholder %s',
    (value) => {
      
      
      expect(() => validate({ ...base, JWT_SECRET: value })).toThrow(/JWT_SECRET/);
    },
  );

  it('accepts a generated secret', () => {
    expect(validate({ ...base, JWT_SECRET: 'A'.repeat(64) }).JWT_SECRET).toHaveLength(64);
  });
});

describe('validate: PUBLIC_SITE_URL', () => {
  it('picks the https entry out of a comma-separated CORS list', () => {
    const env = validate({
      ...base,
      FRONTEND_ORIGIN: 'ubc.workers.dev,https://ubc-military-fund.com',
      PUBLIC_SITE_URL: undefined,
    });
    expect(env.PUBLIC_SITE_URL).toBe('https://ubc-military-fund.com');
  });

  it('prefers an explicit PUBLIC_SITE_URL over the CORS list', () => {
    const env = validate({
      ...base,
      PUBLIC_SITE_URL: 'https://canonical.example',
      FRONTEND_ORIGIN: 'https://other.example,https://third.example',
    });
    expect(env.PUBLIC_SITE_URL).toBe('https://canonical.example');
  });

  it('accepts a plain http origin for local development', () => {
    expect(validate({ ...base, FRONTEND_ORIGIN: 'http://localhost:5173' }).PUBLIC_SITE_URL).toBe(
      'http://localhost:5173',
    );
  });

  it('strips a trailing slash so joined paths never double up', () => {
    expect(validate({ ...base, PUBLIC_SITE_URL: 'https://x.example/' }).PUBLIC_SITE_URL).toBe(
      'https://x.example',
    );
  });

  it('refuses an origin with no scheme', () => {
    expect(() => validate({ ...base, FRONTEND_ORIGIN: 'ubc.workers.dev' })).toThrow(
      /PUBLIC_SITE_URL/,
    );
  });

  it('never yields a comma-joined string', () => {
    const env = validate({ ...base, FRONTEND_ORIGIN: 'https://a.example,https://b.example' });
    expect(env.PUBLIC_SITE_URL).not.toContain(',');
  });
});

describe('validate: local overrides never inherit the production site URL', () => {
  it('keeps an explicit http PUBLIC_SITE_URL instead of a merged https one', () => {
    const merged = {
      ...base,
      PUBLIC_SITE_URL: 'http://localhost:5173',
      FRONTEND_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
    };
    expect(validate(merged).PUBLIC_SITE_URL).toBe('http://localhost:5173');
  });

  it('falls back to the https CORS entry only when PUBLIC_SITE_URL is absent', () => {
    const merged = { ...base, FRONTEND_ORIGIN: 'http://localhost:5173,https://prod.example' };
    expect(validate(merged).PUBLIC_SITE_URL).toBe('https://prod.example');
  });
});

describe('validate: ALLOWED_ORIGINS', () => {
  it('contains every CORS entry plus the canonical site', () => {
    const env = validate({
      ...base,
      PUBLIC_SITE_URL: 'https://canonical.example',
      FRONTEND_ORIGIN: 'http://localhost:5173,https://tunnel.example',
    });

    expect(env.ALLOWED_ORIGINS).toContain('http://localhost:5173');
    expect(env.ALLOWED_ORIGINS).toContain('https://tunnel.example');
    expect(env.ALLOWED_ORIGINS).toContain('https://canonical.example');
  });

  it('drops entries with no scheme, so a bare host cannot be echoed back', () => {
    const env = validate({ ...base, FRONTEND_ORIGIN: 'evil.example,https://ok.example' });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://ok.example']);
  });

  it('normalises trailing slashes so comparison against Origin headers is exact', () => {
    const env = validate({ ...base, FRONTEND_ORIGIN: 'https://a.example/,https://b.example' });
    expect(env.ALLOWED_ORIGINS).toContain('https://a.example');
  });
})

describe('validate: MEMBERSHIP_TTL_SEC', () => {
  it('accepts 0, which disables the cache so revocation is immediate', () => {
    expect(validate({ ...base, MEMBERSHIP_TTL_SEC: '0' }).MEMBERSHIP_TTL_SEC).toBe(0);
  });

  it('defaults to 60 when unset', () => {
    expect(validate({ ...base }).MEMBERSHIP_TTL_SEC).toBe(60);
  });

  it('still rejects a negative or non-numeric value', () => {
    expect(() => validate({ ...base, MEMBERSHIP_TTL_SEC: '-1' })).toThrow(/MEMBERSHIP_TTL_SEC/);
    expect(() => validate({ ...base, MEMBERSHIP_TTL_SEC: 'never' })).toThrow(/MEMBERSHIP_TTL_SEC/);
  });
})

describe('validate: APP_ENV', () => {
  const server = {
    ...base,
    FRONTEND_ORIGIN: 'https://dev.example.com',
    COOKIE_SECURE: 'true',
    COOKIE_SAMESITE: 'strict',
    COOKIE_NAME: '__Host-ubc_session',
  };

  it('treats a missing APP_ENV as prod (fail closed)', () => {
    const { APP_ENV: _omit, ...rest } = base;
    expect(() => validate(rest)).toThrow(/APP_ENV=prod/);
  });

  it('rejects an unknown value', () => {
    expect(() => validate({ ...base, APP_ENV: 'staging' })).toThrow(/APP_ENV must be one of/);
  });

  it('allows http and insecure cookies only locally', () => {
    expect(validate({ ...base }).APP_ENV).toBe('local');
  });

  it.each(['dev', 'prod'])('%s boots with https + secure cookies', (appEnv) => {
    expect(validate({ ...server, APP_ENV: appEnv }).APP_ENV).toBe(appEnv);
  });

  it.each([
    [{ COOKIE_SECURE: 'false' }, /COOKIE_SECURE must be true/],
    [{ COOKIE_SAMESITE: 'none' }, /COOKIE_SAMESITE must be lax or strict/],
    [{ FRONTEND_ORIGIN: 'https://dev.example.com,http://localhost:5173' }, /https only/],
    [{ PUBLIC_SITE_URL: 'http://dev.example.com' }, /https only/],
    [{ COOKIE_NAME: 'ubc_session' }, /__Host-/],
    [{ COOKIE_DOMAIN: '.example.com' }, /COOKIE_DOMAIN must be empty/],
  ])('prod refuses %o', (override, error) => {
    expect(() => validate({ ...server, APP_ENV: 'prod', ...override })).toThrow(error);
  });
});

describe('validate: cookie and retention defaults', () => {
  it('names the cookie per environment', () => {
    expect(validate({ ...base }).COOKIE_NAME).toBe('ubc_session');
    expect(
      validate({ ...base, APP_ENV: 'dev', FRONTEND_ORIGIN: 'https://d.example.com', COOKIE_SECURE: 'true' }).COOKIE_NAME,
    ).toBe('__Host-ubc_session');
  });

  it('refuses a log retention shorter than the database lock', () => {
    expect(() => validate({ ...base, VIEW_LOG_RETENTION_DAYS: '7' })).toThrow(/at least 30/);
  });
});
