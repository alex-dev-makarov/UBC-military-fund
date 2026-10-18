import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotLoginService } from './bot-login.service';
import type { NonceRecord } from './login-session.types';

const TELEGRAM_ID = 111;
const NONCE = 'nonce-abc';
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const HANDOFF = 'handoff-token';

const CONFIG: Record<string, unknown> = {
  TELEGRAM_CHAT_ID: '-100123',
  TELEGRAM_BOT_TOKEN: 'bot-token',
  PUBLIC_SITE_URL: 'https://site.example',
  HANDOFF_TTL_SEC: 120,
};

function nonceRecord(overrides: Partial<NonceRecord> = {}): NonceRecord {
  return {
    nonce: NONCE,
    expires_at: NOW + 60_000,
    status: 'pending',
    telegram_id: null,
    origin: null,
    consumed_at: null,
    code: 2,
    choices: '1,2,3',
    binding_hash: 'hash',
    client: 'Safari',
    ...overrides,
  };
}

describe('BotLoginService', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let securityLog: { record: ReturnType<typeof vi.fn> };
  let nonces: {
    find: ReturnType<typeof vi.fn>;
    deny: ReturnType<typeof vi.fn>;
    startConfirm: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    denyUnconsumedFor: ReturnType<typeof vi.fn>;
  };
  let handoffs: { create: ReturnType<typeof vi.fn>; consumeAllFor: ReturnType<typeof vi.fn> };
  let telegram: { checkGroupMembership: ReturnType<typeof vi.fn> };
  let users: { revokeSessions: ReturnType<typeof vi.fn> };
  let service: BotLoginService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    config = { get: vi.fn((key: string) => CONFIG[key]) };
    securityLog = { record: vi.fn() };
    nonces = {
      find: vi.fn(),
      deny: vi.fn(),
      startConfirm: vi.fn(),
      confirm: vi.fn(),
      denyUnconsumedFor: vi.fn(),
    };
    handoffs = { create: vi.fn(() => HANDOFF), consumeAllFor: vi.fn() };
    telegram = { checkGroupMembership: vi.fn() };
    users = { revokeSessions: vi.fn() };
    service = new BotLoginService(
      securityLog as never,
      config as never,
      nonces as never,
      handoffs as never,
      telegram as never,
      users as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('beginConfirm', () => {
    it('is stale when the nonce record is missing, checking nothing', async () => {
      nonces.find.mockReturnValue(undefined);
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'stale' });
      expect(telegram.checkGroupMembership).not.toHaveBeenCalled();
      expect(nonces.deny).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('is stale when the nonce is no longer pending', async () => {
      nonces.find.mockReturnValue(nonceRecord({ status: 'confirming' }));
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'stale' });
      expect(telegram.checkGroupMembership).not.toHaveBeenCalled();
    });

    it('is stale when the nonce has expired', async () => {
      nonces.find.mockReturnValue(nonceRecord({ expires_at: NOW }));
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'stale' });
      expect(telegram.checkGroupMembership).not.toHaveBeenCalled();
    });

    it('is stale when the nonce has no choices', async () => {
      nonces.find.mockReturnValue(nonceRecord({ choices: null }));
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'stale' });
      expect(telegram.checkGroupMembership).not.toHaveBeenCalled();
    });

    it('is unavailable when membership cannot be determined, changing nothing', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      telegram.checkGroupMembership.mockResolvedValue({ determined: false, reason: 'timeout' });
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'unavailable', reason: 'timeout' });
      expect(nonces.deny).not.toHaveBeenCalled();
      expect(nonces.startConfirm).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('checks membership against the configured group and bot token', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: true });
      nonces.startConfirm.mockReturnValue(true);
      await service.beginConfirm(NONCE, TELEGRAM_ID);
      expect(telegram.checkGroupMembership).toHaveBeenCalledWith(TELEGRAM_ID, '-100123', 'bot-token');
    });

    it('denies the nonce and logs auth.not_member for non-members', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: false });
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'not-member' });
      expect(nonces.deny).toHaveBeenCalledWith(NONCE);
      expect(securityLog.record).toHaveBeenCalledWith('auth.not_member', { method: 'bot', telegram_id: TELEGRAM_ID });
      expect(nonces.startConfirm).not.toHaveBeenCalled();
    });

    it('is used when the nonce cannot start confirmation, logging nothing', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: true });
      nonces.startConfirm.mockReturnValue(false);
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({ kind: 'used' });
      expect(nonces.startConfirm).toHaveBeenCalledWith(NONCE, TELEGRAM_ID);
      expect(securityLog.record).not.toHaveBeenCalled();
      expect(nonces.deny).not.toHaveBeenCalled();
    });

    it('starts confirmation, logs auth.confirm_sent and returns the choices for members', async () => {
      nonces.find.mockReturnValue(nonceRecord());
      telegram.checkGroupMembership.mockResolvedValue({ determined: true, isMember: true });
      nonces.startConfirm.mockReturnValue(true);
      expect(await service.beginConfirm(NONCE, TELEGRAM_ID)).toEqual({
        kind: 'ok',
        client: 'Safari',
        choices: ['1', '2', '3'],
      });
      expect(nonces.startConfirm).toHaveBeenCalledWith(NONCE, TELEGRAM_ID);
      expect(securityLog.record).toHaveBeenCalledWith('auth.confirm_sent', { telegram_id: TELEGRAM_ID, client: 'Safari' });
      expect(nonces.deny).not.toHaveBeenCalled();
    });
  });

  describe('pick', () => {
    it('is invalid when the confirmation no longer matches, creating no handoff', () => {
      nonces.confirm.mockReturnValue('invalid');
      expect(service.pick(NONCE, TELEGRAM_ID, 2)).toEqual({ kind: 'invalid' });
      expect(nonces.confirm).toHaveBeenCalledWith(NONCE, TELEGRAM_ID, 2);
      expect(handoffs.create).not.toHaveBeenCalled();
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('is wrong for a mismatched number, logging auth.wrong_code and creating no handoff', () => {
      nonces.confirm.mockReturnValue('wrong');
      expect(service.pick(NONCE, TELEGRAM_ID, 1)).toEqual({ kind: 'wrong' });
      expect(securityLog.record).toHaveBeenCalledWith('auth.wrong_code', { telegram_id: TELEGRAM_ID });
      expect(handoffs.create).not.toHaveBeenCalled();
    });

    it('creates a handoff on the record origin and builds the link for an authorized pick', () => {
      nonces.confirm.mockReturnValue('authorized');
      nonces.find.mockReturnValue(nonceRecord({ status: 'authorized', origin: 'https://origin.example', client: 'Chrome' }));
      expect(service.pick(NONCE, TELEGRAM_ID, 2)).toEqual({
        kind: 'ok',
        client: 'Chrome',
        link: `https://origin.example/members-details-ubc/secret#t=${HANDOFF}`,
      });
      expect(handoffs.create).toHaveBeenCalledWith(TELEGRAM_ID, 120_000, 'https://origin.example');
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('falls back to PUBLIC_SITE_URL when the record has no origin, and encodes the handoff', () => {
      nonces.confirm.mockReturnValue('authorized');
      nonces.find.mockReturnValue(nonceRecord({ status: 'authorized', origin: null, client: null }));
      handoffs.create.mockReturnValue('a b/c');
      expect(service.pick(NONCE, TELEGRAM_ID, 2)).toEqual({
        kind: 'ok',
        client: null,
        link: 'https://site.example/members-details-ubc/secret#t=a%20b%2Fc',
      });
      expect(handoffs.create).toHaveBeenCalledWith(TELEGRAM_ID, 120_000, 'https://site.example');
    });
  });

  describe('revokeAll', () => {
    it('revokes sessions, denies unconsumed logins, consumes handoffs and logs, in that order', () => {
      nonces.denyUnconsumedFor.mockReturnValue(2);
      handoffs.consumeAllFor.mockReturnValue(1);

      service.revokeAll(TELEGRAM_ID);

      expect(users.revokeSessions).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(nonces.denyUnconsumedFor).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(handoffs.consumeAllFor).toHaveBeenCalledWith(TELEGRAM_ID);
      expect(securityLog.record).toHaveBeenCalledWith('session.revoked_by_user', {
        telegram_id: TELEGRAM_ID,
        logins: 2,
        links: 1,
      });
      const order = [
        users.revokeSessions.mock.invocationCallOrder[0]!,
        nonces.denyUnconsumedFor.mock.invocationCallOrder[0]!,
        handoffs.consumeAllFor.mock.invocationCallOrder[0]!,
        securityLog.record.mock.invocationCallOrder[0]!,
      ];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });
});
