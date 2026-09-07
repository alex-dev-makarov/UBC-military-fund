import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt.guard';

const SECRET = 'test-secret';
const COOKIE = 'ubc_session';

const config = { get: (key: string) => (key === 'COOKIE_NAME' ? COOKIE : undefined) } as never;

function contextWithCookies(cookies: Record<string, string>): {
  context: ExecutionContext;
  request: { cookies: Record<string, string>; user?: unknown };
} {
  const request = { cookies };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET, signOptions: { algorithm: 'HS256' } });
  const guard = new JwtAuthGuard(jwt, config);

  beforeEach(() => {

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a request with no cookie at all', async () => {
    const { context } = contextWithCookies({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed token', async () => {
    const { context } = contextWithCookies({ [COOKIE]: 'not.a.jwt' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = new JwtService({ secret: 'attacker-secret' }).sign({ sub: 1 });
    const { context } = contextWithCookies({ [COOKIE]: forged });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ sub: 1, first_name: 'Test' }, { expiresIn: '-1s' });
    const { context } = contextWithCookies({ [COOKIE]: expired });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an alg:none token', async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 1 })}.`;
    const { context } = contextWithCookies({ [COOKIE]: none });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ignores a valid token presented under a different cookie name', async () => {
    const valid = jwt.sign({ sub: 1, first_name: 'Test' });
    const { context } = contextWithCookies({ some_other_cookie: valid });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and attaches the payload to the request', async () => {
    const valid = jwt.sign({ sub: 777, first_name: 'Test', username: 'test' });
    const { context, request } = contextWithCookies({ [COOKIE]: valid });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 777, first_name: 'Test', username: 'test' });
  });

  it('does not disclose why verification failed', async () => {
    const expired = jwt.sign({ sub: 1 }, { expiresIn: '-1s' });
    const { context } = contextWithCookies({ [COOKIE]: expired });

    await guard.canActivate(context).catch((error: UnauthorizedException) => {
      expect(JSON.stringify(error.getResponse())).not.toMatch(/expired/i);
    });
    expect.assertions(1);
  });
});
