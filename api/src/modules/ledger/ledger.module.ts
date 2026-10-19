import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { ViewLogRepository } from './view-log.repository';
import { RetentionService } from './retention.service';

@Module({
  providers: [LedgerRepository, LedgerService, ViewLogRepository, RetentionService],
  exports: [LedgerRepository, LedgerService, ViewLogRepository],
})
export class LedgerModule {}
