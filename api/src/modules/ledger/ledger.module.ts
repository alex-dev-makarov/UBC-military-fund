import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { ViewLogRepository } from './view-log.repository';
import { RetentionService } from './retention.service';

@Module({
  providers: [LedgerRepository, ViewLogRepository, RetentionService],
  exports: [LedgerRepository, ViewLogRepository],
})
export class LedgerModule {}
