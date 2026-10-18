import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ExpenseBotModule } from '../expense-bot';
import { TelegramModule } from '../../integrations/telegram';
import { BotUpdatesService } from './bot-updates.service';

@Module({
  imports: [AuthModule, ExpenseBotModule, TelegramModule],
  providers: [BotUpdatesService],
})
export class TelegramBotModule {}
