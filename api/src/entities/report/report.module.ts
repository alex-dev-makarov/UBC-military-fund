import { Module } from '@nestjs/common';
import { LedgerRepository } from './api/ledger.repository';
import { ViewLogRepository } from './api/view-log.repository';
import { RetentionService } from './api/retention.service';

@Module({
  providers: [LedgerRepository, ViewLogRepository, RetentionService],
  exports: [LedgerRepository, ViewLogRepository],
})
export class LedgerModule {}
