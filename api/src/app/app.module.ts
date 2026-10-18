import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../shared/db';
import { SecurityLogModule } from '../shared/log';
import { HealthController } from '../shared/health';
import { AuthModule } from '../modules/auth';
import { ReportModule } from '../modules/report';
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
    SecurityLogModule,
    AuthModule,
    ReportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
