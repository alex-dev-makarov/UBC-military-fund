import { Module } from '@nestjs/common';
import { NonceRepository } from './api/nonce.repository';
import { HandoffRepository } from './api/handoff.repository';

@Module({
  providers: [NonceRepository, HandoffRepository],
  exports: [NonceRepository, HandoffRepository],
})
export class LoginSessionModule {}
