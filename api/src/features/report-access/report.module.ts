import { Module } from '@nestjs/common';
import { AuthModule } from '../auth-telegram';
import { FundModule } from '../../entities/fund';
import { LedgerModule } from '../../entities/report';
import { ReportController } from './api/report.controller';

@Module({
  imports: [AuthModule, FundModule, LedgerModule],
  controllers: [ReportController],
})
export class ReportModule {}
