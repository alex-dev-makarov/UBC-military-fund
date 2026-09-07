import { Module } from '@nestjs/common';
import { UserRepository } from './api/user.repository';

@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
