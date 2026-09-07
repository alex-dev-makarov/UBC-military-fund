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
import type { AuthUserPayload } from '../../../shared/auth/session.types';
import { TelegramService } from '../../../shared/telegram';
import { UserRepository } from '../api/user.repository';

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  private readonly logger = new Logger(ChannelMemberGuard.name);

  constructor(
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly telegram: TelegramService,
    private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = request.user as AuthUserPayload | undefined;

    if (!payload?.sub) throw new UnauthorizedException();

    const ttlMs = this.config.get('MEMBERSHIP_TTL_SEC', { infer: true }) * 1000;
    const cached = this.users.findById(payload.sub);
    const now = Date.now();

    if (ttlMs > 0 && cached && now - cached.membership_checked_at < ttlMs) {
      if (cached.is_member === 1) return true;
      throw new ForbiddenException('Access denied');
    }

    const result = await this.telegram.checkGroupMembership(
      payload.sub,
      this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
      this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
    );

    if (!result.determined) {

      this.logger.warn(`membership undetermined (${result.reason}) for ${payload.sub}`);
      throw new ServiceUnavailableException('Membership check unavailable');
    }

    this.users.setMembership(payload.sub, result.isMember);

    if (!result.isMember) throw new ForbiddenException('Access denied');
    return true;
  }
}
