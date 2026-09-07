import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import type { AuthUserPayload } from '../../../shared/auth/session.types';
import { UserRepository } from '../../../entities/user';

export type { AuthUserPayload };

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
  ) {}

  async issueSessionFor(user: {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  }): Promise<{ token: string; user: AuthUserPayload }> {
    const userPayload: AuthUserPayload = {
      sub: user.telegramId,
      first_name: user.firstName,
      ...(user.lastName ? { last_name: user.lastName } : {}),
      ...(user.username ? { username: user.username } : {}),
      ...(user.photoUrl ? { photo_url: user.photoUrl } : {}),
    };

    this.users.recordLogin(user.telegramId);

    const jwtExpiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await this.jwtService.signAsync(userPayload as any, {
      expiresIn: jwtExpiresIn as any,
    });

    return { token, user: userPayload };
  }

  async verifyToken(token: string): Promise<AuthUserPayload> {
    return this.jwtService.verifyAsync<AuthUserPayload>(token);
  }
}
