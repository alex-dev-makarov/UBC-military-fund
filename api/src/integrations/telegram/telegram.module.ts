import { Module } from '@nestjs/common';
import { BotApi } from './bot-api.service';
import { TelegramService } from './telegram.service';

@Module({
  providers: [TelegramService, BotApi],
  exports: [TelegramService, BotApi],
})
export class TelegramModule {}
