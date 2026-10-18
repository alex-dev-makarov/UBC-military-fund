import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { FundModule } from '../fund';
import { LedgerModule } from '../ledger';
import { MonobankModule } from '../../integrations/monobank';
import { NbuModule } from '../../integrations/nbu';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [AuthModule, FundModule, LedgerModule, MonobankModule, NbuModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
