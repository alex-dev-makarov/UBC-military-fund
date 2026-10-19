import { Module } from '@nestjs/common';
import { FundRepository } from './fund.repository';
import { FundService } from './fund.service';

@Module({
  providers: [FundRepository, FundService],
  exports: [FundRepository, FundService],
})
export class FundModule {}
