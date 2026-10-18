import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { UserModule, ChannelMemberGuard, SessionValidGuard } from '../../entities/user';
import { TelegramModule } from '../../integrations/telegram';
import { LedgerModule } from '../../entities/report';
import { ExpenseBotService } from '../expense-bot';
import { GoogleModule } from '../../integrations/google';
import { JwtAuthGuard } from '../../shared/auth';
import { LoginSessionModule } from '../../entities/login-session';
import { BotUpdatesService } from './model/bot-updates.service';
import { AuthService } from './model/auth.service';
import { AuthController } from './api/auth.controller';

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
    LoginSessionModule,
    LedgerModule,
    TelegramModule,
    GoogleModule,
  ],
  providers: [
    ExpenseBotService,
    AuthService,
    BotUpdatesService,
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
    LoginSessionModule,
  ],
})
export class AuthModule {}
