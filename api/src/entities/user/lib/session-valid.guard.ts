import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityLogService } from '../../../shared/log';
import { UserRepository } from '../api/user.repository';

@Injectable()
export class SessionValidGuard implements CanActivate {
  constructor(
    private readonly users: UserRepository,
    private readonly securityLog: SecurityLogService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const payload = context.switchToHttp().getRequest<Request>().user;
    if (!payload?.sub || payload.iat === undefined) throw new UnauthorizedException();
    const issuedAtMs = payload.iat_ms ?? payload.iat * 1000;
    if (this.users.isSessionRevoked(payload.sub, issuedAtMs)) {
      this.securityLog.record('session.revoked', { telegram_id: payload.sub });
      throw new UnauthorizedException();
    }
    return true;
  }
}
