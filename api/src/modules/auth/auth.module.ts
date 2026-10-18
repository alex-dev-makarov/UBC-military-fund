import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { UserModule, ChannelMemberGuard, SessionValidGuard } from '../user';
import { TelegramModule } from '../../integrations/telegram';
import { JwtAuthGuard } from '../../shared/auth';
import { NonceRepository } from './nonce.repository';
import { HandoffRepository } from './handoff.repository';
import { AuthService } from './auth.service';
import { BotLoginService } from './bot-login.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService<ValidatedEnv, true>) => {
        const secret = configService.get('JWT_SECRET', { infer: true });
        const issuer = `ubc-${configService.get('APP_ENV', { infer: true })}`;
        return {
          secret,
          signOptions: { algorithm: 'HS256', issuer },
          verifyOptions: { algorithms: ['HS256'], issuer },
        };
      },
      inject: [ConfigService],
    }),

    UserModule,
    TelegramModule,
  ],
  providers: [
    NonceRepository,
    HandoffRepository,
    AuthService,
    BotLoginService,
    ChannelMemberGuard,
    SessionValidGuard,
    JwtAuthGuard,
  ],
  controllers: [AuthController],

  exports: [
    JwtModule,
    TelegramModule,
    ChannelMemberGuard,
    SessionValidGuard,
    JwtAuthGuard,
    UserModule,
    BotLoginService,
  ],
})
export class AuthModule {}
