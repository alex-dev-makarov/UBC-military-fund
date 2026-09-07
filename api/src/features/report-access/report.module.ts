import { Module } from '@nestjs/common';
import { AuthModule } from '../auth-telegram';
import { FundModule } from '../../entities/fund';
import { ReportController } from './api/report.controller';

@Module({
  imports: [AuthModule, FundModule],
  controllers: [ReportController],
})
export class ReportModule {}
