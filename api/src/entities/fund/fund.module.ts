import { Module } from '@nestjs/common';
import { FundRepository } from './api/fund.repository';
import { JarBalanceService } from './api/jar-balance.service';
import { UsdRateService } from './api/usd-rate.service';

@Module({
  providers: [FundRepository, JarBalanceService, UsdRateService],
  exports: [FundRepository, JarBalanceService, UsdRateService],
})
export class FundModule {}
