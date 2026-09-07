import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../shared/db';
import { HealthController } from '../shared/health';
import { AuthModule } from '../features/auth-telegram';
import { ReportModule } from '../features/report-access';
import { validate } from './config/env';

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
    AuthModule,
    ReportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
