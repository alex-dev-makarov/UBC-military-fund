import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ValidatedEnv } from '../../shared/config/env.types';
import type { AuthUserPayload } from '../../shared/auth/session.types';
import { TelegramService } from '../../integrations/telegram';
import { describeClient } from '../../shared/http';
import { SecurityLogService } from '../../shared/log';
import { UserRepository } from '../user';
import { NonceRepository } from './nonce.repository';
import { HandoffRepository } from './handoff.repository';
import { hashBinding, loginChoices, newBinding } from './login-code';

export type { AuthUserPayload };

const FIRST_NAME = 'Учасник';

export interface StartLoginInput {
  origin: string;
  userAgent: string | undefined;
  ip: string | undefined;
}

export interface StartLoginResult {
  nonce: string;
  code: number;
  expiresIn: number;
  url: string;
  bindingToken: string;
  bindingMaxAgeMs: number;
}

export type PollLoginResult =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'denied' }
  | { kind: 'pending' }
  | { kind: 'authorized'; token: string; user: AuthUserPayload };

export type RedeemHandoffResult =
  | { kind: 'invalid-input' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'authorized'; token: string; user: AuthUserPayload };

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
    private readonly nonces: NonceRepository,
    private readonly handoffs: HandoffRepository,
    private readonly telegram: TelegramService,
    private readonly securityLog: SecurityLogService,
  ) {}

  async issueSessionFor(user: {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  }): Promise<{ token: string; user: AuthUserPayload }> {
    const userPayload: AuthUserPayload = {
      sub: user.telegramId,
      iat_ms: Date.now(),
      first_name: user.firstName,
      ...(user.lastName ? { last_name: user.lastName } : {}),
      ...(user.username ? { username: user.username } : {}),
      ...(user.photoUrl ? { photo_url: user.photoUrl } : {}),
    };

    this.users.recordLogin(user.telegramId);

    const jwtExpiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await this.jwtService.signAsync(userPayload as any, {
      expiresIn: jwtExpiresIn as any,
    });

    return { token, user: userPayload };
  }

  /** Returns the normalised origin when allowed; otherwise logs and returns null. */
  checkOrigin(origin: string | undefined, path: string, ip: string | undefined): string | null {
    const normalised = origin?.replace(/\/+$/, '');
    if (normalised && this.config.get('ALLOWED_ORIGINS', { infer: true }).includes(normalised)) return normalised;
    this.securityLog.record('auth.bad_origin', { origin: normalised ?? null, path, ip });
    return null;
  }

  async startLogin(input: StartLoginInput): Promise<StartLoginResult> {
    const bot = await this.telegram
      .getBotUsername(this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }))
      .catch(() => {
        throw new ServiceUnavailableException('Telegram is unavailable, try again');
      });
    const ttlSec = this.config.get('LOGIN_NONCE_TTL_SEC', { infer: true });
    const { code, choices } = loginChoices();
    const binding = newBinding();

    const record = this.nonces.create(ttlSec * 1000, {
      origin: input.origin,
      code,
      choices,
      bindingHash: binding.hash,
      client: describeClient(input.userAgent),
    });

    this.securityLog.record('auth.start', { ip: input.ip });
    return {
      nonce: record.nonce,
      code,
      expiresIn: ttlSec,
      url: `https://t.me/${bot}?start=${record.nonce}`,
      bindingToken: binding.token,
      bindingMaxAgeMs: ttlSec * 1000,
    };
  }

  async pollLogin(nonce: unknown, bindingCookie: unknown, ip: string | undefined): Promise<PollLoginResult> {
    if (!nonce || typeof nonce !== 'string') return { kind: 'invalid' };

    const record = this.nonces.find(nonce);
    if (
      !record ||
      record.expires_at <= Date.now() ||
      typeof bindingCookie !== 'string' ||
      record.binding_hash !== hashBinding(bindingCookie)
    ) {
      return { kind: 'expired' };
    }

    if (record.status === 'denied') return { kind: 'denied' };
    if (record.status !== 'authorized') return { kind: 'pending' };

    const consumed = this.nonces.consume(nonce, hashBinding(bindingCookie));
    if (!consumed || consumed.telegram_id === null) return { kind: 'expired' };

    const issued = await this.issueSessionFor({ telegramId: consumed.telegram_id, firstName: FIRST_NAME });
    this.securityLog.record('auth.login', { method: 'poll', telegram_id: consumed.telegram_id, ip });
    return { kind: 'authorized', token: issued.token, user: issued.user };
  }

  async redeemHandoff(token: unknown, ip: string | undefined): Promise<RedeemHandoffResult> {
    if (typeof token !== 'string' || token.length === 0) return { kind: 'invalid-input' };

    const telegramId = this.handoffs.peek(token);
    if (!telegramId) return { kind: 'invalid' };

    const membership = await this.telegram.checkGroupMembership(
      telegramId,
      this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
      this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
    );
    if (!membership.determined) return { kind: 'unavailable' };
    if (!membership.isMember) {
      this.handoffs.consume(token);
      this.securityLog.record('auth.not_member', { method: 'handoff', telegram_id: telegramId, ip });
      return { kind: 'denied' };
    }
    if (this.handoffs.consume(token) === undefined) return { kind: 'invalid' };

    const issued = await this.issueSessionFor({ telegramId, firstName: FIRST_NAME });
    this.securityLog.record('auth.login', { method: 'handoff', telegram_id: telegramId, ip });
    return { kind: 'authorized', token: issued.token, user: issued.user };
  }

  async logout(sessionToken: unknown, ip: string | undefined): Promise<void> {
    if (typeof sessionToken !== 'string') return;
    const payload = await this.jwtService.verifyAsync<AuthUserPayload>(sessionToken).catch(() => undefined);
    if (!payload?.sub) return;
    this.users.revokeSessions(payload.sub);
    this.securityLog.record('auth.logout', { telegram_id: payload.sub, ip });
  }
}
