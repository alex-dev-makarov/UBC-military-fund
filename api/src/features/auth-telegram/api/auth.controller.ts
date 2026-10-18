import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Request, Response } from 'express';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import type { AuthUserPayload } from '../../../shared/auth/session.types';
import { JwtAuthGuard } from '../../../shared/auth';
import { TelegramService } from '../../../integrations/telegram';
import { RateLimit, RateLimitGuard, clientIp, describeClient } from '../../../shared/http';
import { SecurityLogService } from '../../../shared/log';
import { NonceRepository, HandoffRepository } from '../../../entities/login-session';
import { SessionValidGuard, UserRepository } from '../../../entities/user';
import { AuthService } from '../model/auth.service';
import { hashBinding, loginChoices, newBinding } from '../model/login-code';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly securityLog: SecurityLogService,
    private readonly authService: AuthService,
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly nonces: NonceRepository,
    private readonly handoffs: HandoffRepository,
    private readonly telegram: TelegramService,
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  @Post('telegram/start')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60_000)
  async startTelegramLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ nonce: string; code: number; expiresIn: number; url: string }> {
    const origin = this.requireOrigin(req);
    const bot = await this.telegram
      .getBotUsername(this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }))
      .catch(() => {
        throw new ServiceUnavailableException('Telegram is unavailable, try again');
      });
    const ttlSec = this.config.get('LOGIN_NONCE_TTL_SEC', { infer: true });
    const { code, choices } = loginChoices();
    const binding = newBinding();

    const record = this.nonces.create(ttlSec * 1000, {
      origin,
      code,
      choices,
      bindingHash: binding.hash,
      client: describeClient(req.headers['user-agent']),
    });

    res.cookie(this.bindingCookie(), binding.token, this.cookieOptions(ttlSec * 1000));
    this.securityLog.record('auth.start', { ip: this.ip(req) });
    return {
      nonce: record.nonce,
      code,
      expiresIn: ttlSec,
      url: `https://t.me/${bot}?start=${record.nonce}`,
    };
  }

  @Get('telegram/poll')
  @UseGuards(RateLimitGuard)
  @RateLimit(90, 60_000)
  async pollTelegramLogin(
    @Query('nonce') nonce: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!nonce || typeof nonce !== 'string') {
      res.status(HttpStatus.BAD_REQUEST).json({ status: 'invalid' });
      return;
    }

    const record = this.nonces.find(nonce);
    const binding = req.cookies?.[this.bindingCookie()];
    if (
      !record ||
      record.expires_at <= Date.now() ||
      typeof binding !== 'string' ||
      record.binding_hash !== hashBinding(binding)
    ) {
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

    const consumed = this.nonces.consume(nonce, hashBinding(binding));
    if (!consumed || consumed.telegram_id === null) {
      res.status(HttpStatus.OK).json({ status: 'expired' });
      return;
    }

    const { token, user } = await this.authService.issueSessionFor({
      telegramId: consumed.telegram_id,
      firstName: 'Учасник',
    });
    res.clearCookie(this.bindingCookie(), this.cookieOptions());
    this.setSessionCookie(res, token);
    this.securityLog.record('auth.login', { method: 'poll', telegram_id: consumed.telegram_id, ip: this.ip(req) });
    res.status(HttpStatus.OK).json({ status: 'authorized', user });
  }

  @Post('telegram/handoff')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60_000)
  async redeemHandoff(
    @Body() body: { token?: unknown },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.requireOrigin(req);
    if (!req.is('application/json')) throw new UnsupportedMediaTypeException();

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
      this.securityLog.record('auth.not_member', { method: 'handoff', telegram_id: telegramId, ip: this.ip(req) });
      res.status(HttpStatus.FORBIDDEN).json({ status: 'denied' });
      return;
    }
    if (this.handoffs.consume(handoff) === undefined) {
      res.status(HttpStatus.UNAUTHORIZED).json({ status: 'invalid' });
      return;
    }

    const { token, user } = await this.authService.issueSessionFor({ telegramId, firstName: 'Учасник' });
    this.setSessionCookie(res, token);
    this.securityLog.record('auth.login', { method: 'handoff', telegram_id: telegramId, ip: this.ip(req) });
    res.status(HttpStatus.OK).json({ status: 'authorized', user });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60_000)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.requireOrigin(req);
    const token = req.cookies?.[this.sessionCookie()];
    if (typeof token === 'string') {
      const payload = await this.jwt.verifyAsync<AuthUserPayload>(token).catch(() => undefined);
      if (payload?.sub) {
        this.users.revokeSessions(payload.sub);
        this.securityLog.record('auth.logout', { telegram_id: payload.sub, ip: this.ip(req) });
      }
    }
    res.clearCookie(this.sessionCookie(), this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, SessionValidGuard, RateLimitGuard)
  @RateLimit(60, 60_000, 'user')
  getMe(@Req() req: Request): AuthUserPayload {
    return req.user!;
  }

  private requireOrigin(req: Request): string {
    const origin = req.headers.origin?.replace(/\/+$/, '');
    if (origin && this.config.get('ALLOWED_ORIGINS', { infer: true }).includes(origin)) return origin;
    this.securityLog.record('auth.bad_origin', { origin: origin ?? null, path: req.path, ip: this.ip(req) });
    throw new ForbiddenException('Origin not allowed');
  }

  private ip(req: Request): string | undefined {
    return clientIp(req, this.config.get('APP_ENV', { infer: true }) !== 'local');
  }

  private sessionCookie(): string {
    return this.config.get('COOKIE_NAME', { infer: true });
  }

  private bindingCookie(): string {
    return `${this.sessionCookie()}_login`;
  }

  private cookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.config.get('COOKIE_SAMESITE', { infer: true }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }) || undefined,
      path: '/',
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(this.sessionCookie(), token, this.cookieOptions(this.config.get('JWT_EXPIRES_MS', { infer: true })));
  }
}
