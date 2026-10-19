import { Global, Module } from '@nestjs/common';
import { SecurityLogRepository } from './security-log.repository';
import { SecurityLogService } from './security-log.service';

@Global()
@Module({
  providers: [SecurityLogRepository, SecurityLogService],
  exports: [SecurityLogService],
})
export class SecurityLogModule {}
