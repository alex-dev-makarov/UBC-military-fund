import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../infra/config/env.types';
import { TelegramService, type MembershipResult } from '../../integrations/telegram';
import { SecurityLogService } from '../security-log';
import { UserRepository } from '../user';
import { NonceRepository } from './nonce.repository';
import { HandoffRepository } from './handoff.repository';
import { HANDOFF_PARAM, HANDOFF_PATH } from './paths';

export type BotBeginConfirmResult =
  | { kind: 'stale' }
  | { kind: 'unavailable'; reason: Extract<MembershipResult, { determined: false }>['reason'] }
  | { kind: 'not-member' }
  | { kind: 'used' }
  | { kind: 'ok'; client: string | null; choices: string[] };

export type BotPickResult =
  | { kind: 'invalid' }
  | { kind: 'wrong' }
  | { kind: 'ok'; client: string | null; link: string };

/** Auth-domain logic for the Telegram bot login flow: nonces, handoffs, membership and security-log records. */
@Injectable()
export class BotLoginService {
  constructor(
    private readonly securityLog: SecurityLogService,
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly nonces: NonceRepository,
    private readonly handoffs: HandoffRepository,
    private readonly telegram: TelegramService,
    private readonly users: UserRepository,
  ) {}

  async beginConfirm(nonce: string, telegramId: number): Promise<BotBeginConfirmResult> {
    const record = this.nonces.find(nonce);
    if (!record || record.status !== 'pending' || record.expires_at <= Date.now() || !record.choices) {
      return { kind: 'stale' };
    }

    const membership = await this.telegram.checkGroupMembership(
      telegramId,
      this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
      this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
    );
    if (!membership.determined) return { kind: 'unavailable', reason: membership.reason };
    if (!membership.isMember) {
      this.nonces.deny(nonce);
      this.securityLog.record('auth.not_member', { method: 'bot', telegram_id: telegramId });
      return { kind: 'not-member' };
    }

    if (!this.nonces.startConfirm(nonce, telegramId)) return { kind: 'used' };

    this.securityLog.record('auth.confirm_sent', { telegram_id: telegramId, client: record.client });
    return { kind: 'ok', client: record.client, choices: record.choices.split(',') };
  }

  pick(nonce: string, telegramId: number, picked: number): BotPickResult {
    const result = this.nonces.confirm(nonce, telegramId, picked);
    if (result === 'invalid') return { kind: 'invalid' };
    if (result === 'wrong') {
      this.securityLog.record('auth.wrong_code', { telegram_id: telegramId });
      return { kind: 'wrong' };
    }

    const record = this.nonces.find(nonce);
    return {
      kind: 'ok',
      client: record?.client ?? null,
      link: this.handoffLink(telegramId, record?.origin ?? null),
    };
  }

  revokeAll(telegramId: number): void {
    this.users.revokeSessions(telegramId);
    const logins = this.nonces.denyUnconsumedFor(telegramId);
    const links = this.handoffs.consumeAllFor(telegramId);
    this.securityLog.record('session.revoked_by_user', { telegram_id: telegramId, logins, links });
  }

  private handoffLink(telegramId: number, origin: string | null): string {
    const site: string = origin ?? this.config.get('PUBLIC_SITE_URL', { infer: true });
    const ttlSec = this.config.get('HANDOFF_TTL_SEC', { infer: true });
    const handoff = this.handoffs.create(telegramId, ttlSec * 1000, site);
    return `${site}${HANDOFF_PATH}#${HANDOFF_PARAM}=${encodeURIComponent(handoff)}`;
  }
}
