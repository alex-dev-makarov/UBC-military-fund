import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ValidatedEnv } from '../config/env.types';
import { SecurityLogService } from '../../modules/security-log';
import { clientIp } from './client';

interface Limit {
  limit: number;
  windowMs: number;
  by: 'ip' | 'user';
}

const RATE_LIMIT = 'rate-limit';

export const RateLimit = (limit: number, windowMs: number, by: Limit['by'] = 'ip') =>
  SetMetadata(RATE_LIMIT, { limit, windowMs, by } satisfies Limit);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly securityLog: SecurityLogService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.get<Limit | undefined>(RATE_LIMIT, context.getHandler());
    if (!rule) throw new Error(`RateLimitGuard on ${context.getHandler().name} without @RateLimit`);

    const req = context.switchToHttp().getRequest<Request>();
    const behindCloudflare = this.config.get('APP_ENV', { infer: true }) !== 'local';
    if (rule.by === 'user' && req.user?.sub === undefined) {
      throw new Error('RateLimit by user must run after JwtAuthGuard');
    }
    const who =
      rule.by === 'user' ? `u:${req.user!.sub}` : `ip:${clientIp(req, behindCloudflare) ?? 'unknown'}`;
    const key = `${context.getClass().name}.${context.getHandler().name}:${who}`;

    const now = Date.now();
    this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + rule.windowMs });
      return true;
    }
    entry.count += 1;
    if (entry.count <= rule.limit) return true;

    if (entry.count === rule.limit + 1) this.securityLog.record('rate.limited', { route: req.path, who });
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
