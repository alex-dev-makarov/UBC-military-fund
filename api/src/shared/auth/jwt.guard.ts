import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { ValidatedEnv } from '../config/env.types';
import type { AuthUserPayload } from './session.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<ValidatedEnv, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.config.get('COOKIE_NAME', { infer: true }) || 'ubc_session';

    const token = request.cookies[cookieName];
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUserPayload>(token);
      request.user = payload;
      return true;
    } catch (error) {

      if (error instanceof Error) {
        console.error(`JWT verification failed: ${error.message}`);
      } else {
        console.error('JWT verification failed with unknown error');
      }
      throw new UnauthorizedException();
    }
  }
}
