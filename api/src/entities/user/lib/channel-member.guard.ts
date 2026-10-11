import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import { TelegramService, type MembershipResult } from '../../../shared/telegram';
import { SecurityLogService } from '../../../shared/log';
import { UserRepository } from '../api/user.repository';

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  private readonly logger = new Logger(ChannelMemberGuard.name);
  private readonly inFlight = new Map<number, Promise<MembershipResult>>();

  constructor(
    private readonly securityLog: SecurityLogService,
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly telegram: TelegramService,
    private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = request.user;
    if (!payload?.sub) throw new UnauthorizedException();

    const ttlMs = this.config.get('MEMBERSHIP_TTL_SEC', { infer: true }) * 1000;
    const cached = this.users.findById(payload.sub);
    if (ttlMs > 0 && cached && Date.now() - cached.membership_checked_at < ttlMs) {
      if (cached.is_member === 1) return true;
      this.securityLog.record('report.forbidden', { telegram_id: payload.sub, cached: true });
      throw new ForbiddenException('Access denied');
    }

    const result = await this.check(payload.sub);
    if (!result.determined) {
      this.logger.warn(`membership undetermined (${result.reason}) for ${payload.sub}`);
      throw new ServiceUnavailableException('Membership check unavailable');
    }

    this.users.setMembership(payload.sub, result.isMember);
    if (!result.isMember) {
      this.securityLog.record('report.forbidden', { telegram_id: payload.sub });
      throw new ForbiddenException('Access denied');
    }
    return true;
  }

  private check(telegramId: number): Promise<MembershipResult> {
    const pending = this.inFlight.get(telegramId);
    if (pending) return pending;
    const request = this.telegram
      .checkGroupMembership(
        telegramId,
        this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
        this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
      )
      .finally(() => this.inFlight.delete(telegramId));
    this.inFlight.set(telegramId, request);
    return request;
  }
}
