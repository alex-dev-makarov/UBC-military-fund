import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger';
import { TelegramModule } from '../../integrations/telegram';
import { GoogleModule } from '../../integrations/google';
import { ExpenseBotService } from './expense-bot.service';

@Module({
  imports: [LedgerModule, TelegramModule, GoogleModule],
  providers: [ExpenseBotService],
  exports: [ExpenseBotService],
})
export class ExpenseBotModule {}
