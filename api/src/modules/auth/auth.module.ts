import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { UserModule, ChannelMemberGuard, SessionValidGuard } from '../user';
import { TelegramModule } from '../../integrations/telegram';
import { LedgerModule } from '../ledger';
import { ExpenseBotService } from '../../features/expense-bot';
import { GoogleModule } from '../../integrations/google';
import { JwtAuthGuard } from '../../shared/auth';
import { NonceRepository } from './nonce.repository';
import { HandoffRepository } from './handoff.repository';
import { BotUpdatesService } from './bot-updates.service';
import { AuthService } from './auth.service';
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
    LedgerModule,
    TelegramModule,
    GoogleModule,
  ],
  providers: [
    ExpenseBotService,
    NonceRepository,
    HandoffRepository,
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
  ],
})
export class AuthModule {}
