import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../infra/db';
import { SecurityLogModule } from '../modules/security-log';
import { HealthController } from '../infra/health';
import { AuthModule } from '../modules/auth';
import { TelegramBotModule } from '../modules/telegram-bot';
import { ReportModule } from '../modules/report';
import { validate } from '../infra/config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        join(__dirname, '..', '..', '.env.local'),
        join(__dirname, '..', '..', '.env'),
      ],
      validate,
    }),
    DatabaseModule,
    SecurityLogModule,
    AuthModule,
    TelegramBotModule,
    ReportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
