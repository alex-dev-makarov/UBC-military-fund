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
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { ValidatedEnv } from '../../shared/config/env.types';
import type { AuthUserPayload } from '../../shared/auth/session.types';
import { JwtAuthGuard } from '../../shared/auth';
import { RateLimit, RateLimitGuard, clientIp } from '../../shared/http';
import { SessionValidGuard } from '../user';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<ValidatedEnv, true>,
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
    const started = await this.authService.startLogin({
      origin,
      userAgent: req.headers['user-agent'],
      ip: this.ip(req),
    });

    res.cookie(this.bindingCookie(), started.bindingToken, this.cookieOptions(started.bindingMaxAgeMs));
    return {
      nonce: started.nonce,
      code: started.code,
      expiresIn: started.expiresIn,
      url: started.url,
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
    const result = await this.authService.pollLogin(nonce, req.cookies?.[this.bindingCookie()], this.ip(req));
    switch (result.kind) {
      case 'invalid':
        res.status(HttpStatus.BAD_REQUEST).json({ status: 'invalid' });
        return;
      case 'expired':
        res.status(HttpStatus.OK).json({ status: 'expired' });
        return;
      case 'denied':
        res.status(HttpStatus.FORBIDDEN).json({ status: 'denied' });
        return;
      case 'pending':
        res.status(HttpStatus.OK).json({ status: 'pending' });
        return;
      case 'authorized':
        res.clearCookie(this.bindingCookie(), this.cookieOptions());
        this.setSessionCookie(res, result.token);
        res.status(HttpStatus.OK).json({ status: 'authorized', user: result.user });
        return;
    }
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

    const result = await this.authService.redeemHandoff(body?.token, this.ip(req));
    switch (result.kind) {
      case 'invalid-input':
        res.status(HttpStatus.BAD_REQUEST).json({ status: 'invalid' });
        return;
      case 'invalid':
        res.status(HttpStatus.UNAUTHORIZED).json({ status: 'invalid' });
        return;
      case 'unavailable':
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'unavailable' });
        return;
      case 'denied':
        res.status(HttpStatus.FORBIDDEN).json({ status: 'denied' });
        return;
      case 'authorized':
        this.setSessionCookie(res, result.token);
        res.status(HttpStatus.OK).json({ status: 'authorized', user: result.user });
        return;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60_000)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.requireOrigin(req);
    await this.authService.logout(req.cookies?.[this.sessionCookie()], this.ip(req));
    res.clearCookie(this.sessionCookie(), this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, SessionValidGuard, RateLimitGuard)
  @RateLimit(60, 60_000, 'user')
  getMe(@Req() req: Request): AuthUserPayload {
    return req.user!;
  }

  private requireOrigin(req: Request): string {
    const origin = this.authService.checkOrigin(req.headers.origin, req.path, this.ip(req));
    if (origin === null) throw new ForbiddenException('Origin not allowed');
    return origin;
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
