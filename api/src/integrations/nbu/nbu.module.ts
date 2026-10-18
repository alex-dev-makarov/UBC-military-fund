import { Module } from '@nestjs/common';
import { UsdRateClient } from './usd-rate.client';

@Module({
  providers: [UsdRateClient],
  exports: [UsdRateClient],
})
export class NbuModule {}
