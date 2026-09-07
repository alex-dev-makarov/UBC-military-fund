import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { UserModule, ChannelMemberGuard } from '../../entities/user';
import { TelegramService } from '../../shared/telegram';
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
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
          },

          verifyOptions: {
            algorithms: ['HS256'],
          },
        };
      },
      inject: [ConfigService],
    }),

    UserModule,
    LoginSessionModule,
  ],
  providers: [
    TelegramService,
    AuthService,
    BotUpdatesService,
    ChannelMemberGuard,
    JwtAuthGuard,
  ],
  controllers: [AuthController],

  exports: [JwtModule, TelegramService, ChannelMemberGuard, JwtAuthGuard, UserModule, LoginSessionModule],
})
export class AuthModule {}
