import {
  Body,
  Controller,
  Get,
  Query,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import type { AuthUserPayload } from '../../../shared/auth/session.types';
import { AuthService } from '../model/auth.service';
import { NonceRepository, HandoffRepository } from '../../../entities/login-session';
import { TelegramService } from '../../../shared/telegram';
import { JwtAuthGuard } from '../../../shared/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly nonces: NonceRepository,
    private readonly handoffs: HandoffRepository,
    private readonly telegram: TelegramService,
  ) {}

  @Post('telegram/start')
  startTelegramLogin(@Req() req: Request): { nonce: string; expiresIn: number } {
    const ttlSec = this.config.get('LOGIN_NONCE_TTL_SEC', { infer: true });
    const record = this.nonces.create(ttlSec * 1000, this.callerOrigin(req));
    return { nonce: record.nonce, expiresIn: ttlSec };
  }

  private callerOrigin(req: Request): string | undefined {
    const origin = req.headers.origin?.replace(/\/+$/, '');
    if (!origin) return undefined;

    const allowed = this.config.get('ALLOWED_ORIGINS', { infer: true });
    return allowed.includes(origin) ? origin : undefined;
  }

  @Post('telegram/handoff')
  async redeemHandoff(
    @Body() body: { token?: unknown },
    @Res() res: Response,
  ): Promise<void> {
    const handoff = body?.token;
    if (typeof handoff !== 'string' || handoff.length === 0) {
      res.status(HttpStatus.BAD_REQUEST).json({ status: 'invalid' });
      return;
    }

    const telegramId = this.handoffs.peek(handoff);
    if (!telegramId) {
      res.status(HttpStatus.UNAUTHORIZED).json({ status: 'invalid' });
      return;
    }

    const membership = await this.telegram.checkGroupMembership(
      telegramId,
      this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
      this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
    );

    if (!membership.determined) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'unavailable' });
      return;
    }
    if (!membership.isMember) {
      this.handoffs.consume(handoff);
      res.status(HttpStatus.FORBIDDEN).json({ status: 'denied' });
      return;
    }

    if (this.handoffs.consume(handoff) === undefined) {
      res.status(HttpStatus.UNAUTHORIZED).json({ status: 'invalid' });
      return;
    }

    const { token, user } = await this.authService.issueSessionFor({
      telegramId,
      firstName: 'Учасник',
    });
    this.setSessionCookie(res, token);
    res.status(HttpStatus.OK).json({ status: 'authorized', user });
  }

  @Get('telegram/poll')
  async pollTelegramLogin(
    @Query('nonce') nonce: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!nonce || typeof nonce !== 'string') {
      res.status(HttpStatus.BAD_REQUEST).json({ status: 'invalid' });
      return;
    }

    const record = this.nonces.find(nonce);

    if (!record || record.expires_at <= Date.now()) {
      res.status(HttpStatus.OK).json({ status: 'expired' });
      return;
    }

    if (record.status === 'denied') {
      res.status(HttpStatus.FORBIDDEN).json({ status: 'denied' });
      return;
    }

    if (record.status !== 'authorized') {
      res.status(HttpStatus.OK).json({ status: 'pending' });
      return;
    }

    const consumed = this.nonces.consume(nonce);
    if (!consumed || consumed.telegram_id === null) {
      res.status(HttpStatus.OK).json({ status: 'expired' });
      return;
    }

    const { token, user } = await this.authService.issueSessionFor({
      telegramId: consumed.telegram_id,
      firstName: 'Учасник',
    });

    this.setSessionCookie(res, token);
    res.status(HttpStatus.OK).json({ status: 'authorized', user });
  }

  private setSessionCookie(res: Response, token: string): void {
    const cookieName = this.config.get('COOKIE_NAME', { infer: true }) || 'ubc_session';
    const cookieDomain = this.config.get('COOKIE_DOMAIN', { infer: true });

    const maxAgeMs = this.config.get('JWT_EXPIRES_MS', { infer: true });

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.config.get('COOKIE_SAMESITE', { infer: true }),
      domain: cookieDomain || undefined,
      path: '/',
      maxAge: maxAgeMs,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request): AuthUserPayload {
    const user = req.user as AuthUserPayload | undefined;
    if (!user) {
      throw new Error('User not found in request (guard should have set it)');
    }
    return user;
  }
}
