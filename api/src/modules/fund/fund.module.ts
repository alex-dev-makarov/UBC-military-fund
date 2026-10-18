import { Module } from '@nestjs/common';
import { FundRepository } from './fund.repository';

@Module({
  providers: [FundRepository],
  exports: [FundRepository],
})
export class FundModule {}
