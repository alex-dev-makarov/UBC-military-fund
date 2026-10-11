import { Global, Module } from '@nestjs/common';
import { SecurityLogService } from './security-log.service';

@Global()
@Module({
  providers: [SecurityLogService],
  exports: [SecurityLogService],
})
export class SecurityLogModule {}
