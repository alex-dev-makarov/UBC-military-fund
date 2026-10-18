import { Module } from '@nestjs/common';
import { AuthModule } from '../auth-telegram';
import { FundModule } from '../../entities/fund';
import { MonobankModule } from '../../integrations/monobank';
import { NbuModule } from '../../integrations/nbu';
import { LedgerModule } from '../../entities/report';
import { ReportController } from './api/report.controller';

@Module({
  imports: [AuthModule, FundModule, LedgerModule, MonobankModule, NbuModule],
  controllers: [ReportController],
})
export class ReportModule {}
