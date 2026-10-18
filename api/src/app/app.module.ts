import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../infra/db';
import { SecurityLogModule } from '../modules/security-log';
import { HealthController } from '../infra/health';
import { AuthModule } from '../modules/auth';
import { TelegramBotModule } from '../modules/telegram-bot';
import { ReportModule } from '../modules/report';
import { validate } from '../infra/config/env';
import { ENV_FILE_PATHS } from '../infra/config/env-files';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [...ENV_FILE_PATHS],
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
