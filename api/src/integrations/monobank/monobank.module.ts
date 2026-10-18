import { Module } from '@nestjs/common';
import { JarBalanceClient } from './jar-balance.client';

@Module({
  providers: [JarBalanceClient],
  exports: [JarBalanceClient],
})
export class MonobankModule {}
