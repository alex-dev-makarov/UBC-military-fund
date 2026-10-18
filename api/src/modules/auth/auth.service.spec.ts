import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { ValidatedEnv } from '../../shared/config/env.types';
import type { TelegramService } from '../../integrations/telegram';
import type { SecurityLogService } from '../../shared/log';
import { describeClient } from '../../shared/http';
import type { UserRepository } from '../user';
import { AuthService } from './auth.service';
import type { NonceRepository } from './nonce.repository';
import type { HandoffRepository } from './handoff.repository';
import type { NonceRecord } from './login-session.types';
import { hashBinding } from './login-code';

const TELEGRAM_ID = 111;
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const IP = '203.0.113.7';
const UA = 'vitest-agent';
const ORIGIN = 'https://app.example';
const PATH = '/auth/telegram/start';
const NONCE = 'nonce-abc';
const BINDING = 'binding-cookie';
const HANDOFF = 'handoff-token';
const JWT = 'signed.jwt';

const CONFIG: Record<string, unknown> = {
  ALLOWED_ORIGINS: [ORIGIN],
  TELEGRAM_BOT_TOKEN: 'bot-token',
  TELEGRAM_CHAT_ID: '-100123',
  LOGIN_NONCE_TTL_SEC: 300,
  JWT_EXPIRES_IN: '1h',
};

function nonceRecord(overrides: Partial<NonceRecord> = {}): NonceRecord {
  return {
    nonce: NONCE,
    expires_at: NOW + 60_000,
    status: 'authorized',
    telegram_id: TELEGRAM_ID,
    origin: ORIGIN,
    consumed_at: null,
    code: 1,
    choices: '1,2',
    binding_hash: hashBinding(BINDING),
    client: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let jwt: { signAsync: ReturnType<typeof vi.fn>; verifyAsync: ReturnType<typeof vi.fn> };
  let users: { recordLogin: ReturnType<typeof vi.fn>; revokeSessions: ReturnType<typeof vi.fn> };
  let nonces: { create: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn>; consume: ReturnType<typeof vi.fn> };
  let handoffs: { peek: ReturnType<typeof vi.fn>; consume: ReturnType<typeof vi.fn> };
  let telegram: { getBotUsername: ReturnType<typeof vi.fn>; checkGroupMembership: ReturnType<typeof vi.fn> };
  let securityLog: { record: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    config = { get: vi.fn((key: string) => CONFIG[key]) };
    jwt = { signAsync: vi.fn(async () => JWT), verifyAsync: vi.fn(async () => ({ sub: TELEGRAM_ID })) };
    users = { recordLogin: vi.fn(), revokeSessions: vi.fn() };
    nonces = {
      create: vi.fn(() => ({ nonce: NONCE })),
      find: vi.fn(() => undefined),
      consume: vi.fn(() => undefined),
    };
    handoffs = { peek: vi.fn(() => undefined), consume: vi.fn(() => undefined) };
    telegram = {
      getBotUsername: vi.fn(async () => 'ubc_bot'),
      checkGroupMembership: vi.fn(async () => ({ determined: true, isMember: true })),
    };
    securityLog = { record: vi.fn() };
    service = new AuthService(
      config as unknown as ConfigService<ValidatedEnv, true>,
      jwt as unknown as JwtService,
      users as unknown as UserRepository,
      nonces as unknown as NonceRepository,
      handoffs as unknown as HandoffRepository,
      telegram as unknown as TelegramService,
      securityLog as unknown as SecurityLogService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkOrigin', () => {
    it('returns the origin when it is allowed, without logging', () => {
      expect(service.checkOrigin(ORIGIN, PATH, IP)).toBe(ORIGIN);
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('strips trailing slashes before matching', () => {
      expect(service.checkOrigin(`${ORIGIN}//`, PATH, IP)).toBe(ORIGIN);
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('returns null and logs a null origin when the header is missing', () => {
      expect(service.checkOrigin(undefined, PATH, IP)).toBeNull();
      expect(securityLog.record).toHaveBeenCalledWith('auth.bad_origin', { origin: null, path: PATH, ip: IP });
    });

    it('returns null and logs an empty origin as-is', () => {
      expect(service.checkOrigin('', PATH, IP)).toBeNull();
      expect(securityLog.record).toHaveBeenCalledWith('auth.bad_origin', { origin: '', path: PATH, ip: IP });
    });

    it('returns null and logs the normalised origin when it is not allowed', () => {
      expect(service.checkOrigin('https://evil.example/', PATH, IP)).toBeNull();
      expect(securityLog.record).toHaveBeenCalledWith('auth.bad_origin', {
        origin: 'https://evil.example',
        path: PATH,
        ip: IP,
      });
    });
  });

  describe('startLogin', () => {
    const input = { origin: ORIGIN, userAgent: UA, ip: IP };

    it('creates a nonce bound to a fresh binding and returns the start payload', async () => {
      const result = await service.startLogin(input);

      expect(telegram.getBotUsername).toHaveBeenCalledWith('bot-token');
      const [ttlMs, created] = nonces.create.mock.calls[0] as [number, Record<string, unknown>];
      expect(ttlMs).toBe(300_000);
      expect(created).toEqual({
        origin: ORIGIN,
        code: expect.any(Number),
        choices: expect.any(Array),
        bindingHash: expect.any(String),
        client: describeClient(UA),
      });
      expect(result).toEqual({
        nonce: NONCE,
        code: created.code,
        expiresIn: 300,
        url: `https://t.me/ubc_bot?start=${NONCE}`,
        bindingToken: expect.any(String),
        bindingMaxAgeMs: 300_000,
      });
      expect(hashBinding(result.bindingToken)).toBe(created.bindingHash);
      expect(securityLog.record).toHaveBeenCalledWith('auth.start', { ip: IP });
    });

    it('throws ServiceUnavailableException when Telegram rejects, creating nothing', async () => {
      telegram.getBotUsername.mockRejectedValue(new Error('down'));

      await expect(service.startLogin(input)).rejects.toThrow(ServiceUnavailableException);
      await expect(service.startLogin(input)).rejects.toThrow('Telegram is unavailable, try again');
      expect(nonces.create).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });
  });

  describe('pollLogin', () => {
    it('returns invalid when the nonce is missing', async () => {
      expect(await service.pollLogin(undefined, BINDING, IP)).toEqual({ kind: 'invalid' });
      expect(await service.pollLogin('', BINDING, IP)).toEqual({ kind: 'invalid' });
      expect(await service.pollLogin(42, BINDING, IP)).toEqual({ kind: 'invalid' });
      expect(nonces.find).not.toHaveBeenCalled();
    });

    it('returns expired when the nonce record does not exist', async () => {
      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'expired' });
    });

    it('returns expired when the record has expired', async () => {
      nonces.find.mockReturnValue(nonceRecord({ expires_at: NOW }));
      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'expired' });
    });

    it('returns expired when the binding cookie is missing', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      expect(await service.pollLogin(NONCE, undefined, IP)).toEqual({ kind: 'expired' });
    });

    it('returns expired when the binding cookie does not match', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      expect(await service.pollLogin(NONCE, 'other-binding', IP)).toEqual({ kind: 'expired' });
    });

    it('returns denied when the nonce was denied', async () => {
      nonces.find.mockReturnValue(nonceRecord({ status: 'denied' }));
      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'denied' });
    });

    it('returns pending while the nonce is not yet authorized', async () => {
      nonces.find.mockReturnValue(nonceRecord({ status: 'pending' }));
      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'pending' });
      expect(nonces.consume).not.toHaveBeenCalled();
    });

    it('returns expired when consuming the nonce fails', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      nonces.consume.mockReturnValue(undefined);

      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'expired' });
      expect(nonces.consume).toHaveBeenCalledWith(NONCE, hashBinding(BINDING));
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('returns expired when the consumed nonce has no telegram id', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      nonces.consume.mockReturnValue(nonceRecord({ telegram_id: null }));

      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({ kind: 'expired' });
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('issues a session, logs auth.login and returns authorized', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      nonces.consume.mockReturnValue(nonceRecord({ consumed_at: NOW }));

      expect(await service.pollLogin(NONCE, BINDING, IP)).toEqual({
        kind: 'authorized',
        token: JWT,
        user: { sub: TELEGRAM_ID, iat_ms: NOW, first_name: 'Учасник' },
      });
      expect(users.recordLogin).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(securityLog.record).toHaveBeenCalledWith('auth.login', {
        method: 'poll',
        telegram_id: TELEGRAM_ID,
        ip: IP,
      });
    });
  });

  describe('redeemHandoff', () => {
    it('returns invalid-input when the token is not a non-empty string', async () => {
      expect(await service.redeemHandoff(undefined, IP)).toEqual({ kind: 'invalid-input' });
      expect(await service.redeemHandoff('', IP)).toEqual({ kind: 'invalid-input' });
      expect(await service.redeemHandoff(7, IP)).toEqual({ kind: 'invalid-input' });
      expect(handoffs.peek).not.toHaveBeenCalled();
    });

    it('returns invalid when the handoff token is unknown', async () => {
      expect(await service.redeemHandoff(HANDOFF, IP)).toEqual({ kind: 'invalid' });
      expect(handoffs.peek).toHaveBeenCalledWith(HANDOFF);
      expect(telegram.checkGroupMembership).not.toHaveBeenCalled();
    });

    it('returns unavailable when membership cannot be determined, without consuming', async () => {
      handoffs.peek.mockReturnValue(TELEGRAM_ID);
      telegram.checkGroupMembership.mockResolvedValue({ determined: false, reason: 'timeout' });

      expect(await service.redeemHandoff(HANDOFF, IP)).toEqual({ kind: 'unavailable' });
      expect(telegram.checkGroupMembership).toHaveBeenCalledWith(TELEGRAM_ID, '-100123', 'bot-token');
      expect(handoffs.consume).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('consumes the token, logs auth.not_member and returns denied for non-members', async () => {
      handoffs.peek.mockReturnValue(TELEGRAM_ID);
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: false });

      expect(await service.redeemHandoff(HANDOFF, IP)).toEqual({ kind: 'denied' });
      expect(handoffs.consume).toHaveBeenCalledWith(HANDOFF);
      expect(securityLog.record).toHaveBeenCalledWith('auth.not_member', {
        method: 'handoff',
        telegram_id: TELEGRAM_ID,
        ip: IP,
      });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('returns invalid when the member token was already consumed by someone else', async () => {
      handoffs.peek.mockReturnValue(TELEGRAM_ID);
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: true });
      handoffs.consume.mockReturnValue(undefined);

      expect(await service.redeemHandoff(HANDOFF, IP)).toEqual({ kind: 'invalid' });
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('issues a session, logs auth.login and returns authorized for members', async () => {
      handoffs.peek.mockReturnValue(TELEGRAM_ID);
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: true });
      handoffs.consume.mockReturnValue(TELEGRAM_ID);

      expect(await service.redeemHandoff(HANDOFF, IP)).toEqual({
        kind: 'authorized',
        token: JWT,
        user: { sub: TELEGRAM_ID, iat_ms: NOW, first_name: 'Учасник' },
      });
      expect(users.recordLogin).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(securityLog.record).toHaveBeenCalledWith('auth.login', {
        method: 'handoff',
        telegram_id: TELEGRAM_ID,
        ip: IP,
      });
      expect(securityLog.record).not.toHaveBeenCalledWith('auth.not_member', expect.anything());
    });
  });

  describe('logout', () => {
    it('does nothing when the session cookie is not a string', async () => {
      await service.logout(undefined, IP);
      await service.logout(5, IP);

      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(users.revokeSessions).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('does nothing when the session token fails verification', async () => {
      jwt.verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));

      await service.logout('bad.jwt', IP);

      expect(users.revokeSessions).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('does nothing when the verified payload has no subject', async () => {
      jwt.verifyAsync.mockResolvedValueOnce({});

      await service.logout('no-sub.jwt', IP);

      expect(users.revokeSessions).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('revokes the user sessions and logs auth.logout for a valid token', async () => {
      await service.logout(JWT, IP);

      expect(jwt.verifyAsync).toHaveBeenCalledWith(JWT);
      expect(users.revokeSessions).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(securityLog.record).toHaveBeenCalledWith('auth.logout', { telegram_id: TELEGRAM_ID, ip: IP });
    });
  });
});
