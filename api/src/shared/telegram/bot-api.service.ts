import { Agent, request } from 'undici';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../config/env.types';

export type Keyboard = Array<Array<{ text: string; callback_data?: string; url?: string }>>;

export interface BotMessageRef {
  message_id: number;
  chat: { id: number };
}

@Injectable()
export class BotApi implements OnModuleDestroy {
  private readonly logger = new Logger(BotApi.name);
  private readonly dispatcher = new Agent({ connections: 4, pipelining: 0 });

  constructor(private readonly config: ConfigService<ValidatedEnv, true>) {}

  async onModuleDestroy(): Promise<void> {
    await this.dispatcher.close().catch(() => undefined);
  }

  send(chatId: number, text: string, keyboard?: Keyboard): Promise<unknown> {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    }).catch((error) => this.logger.warn(`sendMessage failed: ${error instanceof Error ? error.message : error}`));
  }

  edit(message: BotMessageRef, text: string, keyboard?: Keyboard): Promise<unknown> {
    return this.call('editMessageText', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text,
      reply_markup: { inline_keyboard: keyboard ?? [] },
    }).catch((error) => this.logger.warn(`editMessageText failed: ${error instanceof Error ? error.message : error}`));
  }

  answer(callbackQueryId: string): Promise<unknown> {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId }).catch(() => undefined);
  }

  async download(fileId: string): Promise<{ data: Buffer; path: string }> {
    const { file_path: path } = (await this.call('getFile', { file_id: fileId })) as { file_path: string };
    const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    const response = await request(`https://api.telegram.org/file/bot${token}/${path}`, { dispatcher: this.dispatcher });
    if (response.statusCode !== 200) throw new Error(`file download: HTTP ${response.statusCode}`);
    return { data: Buffer.from(await response.body.arrayBuffer()), path };
  }

  async call(method: string, body: unknown): Promise<unknown> {
    const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    const response = await request(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      headersTimeout: 30_000,
      bodyTimeout: 30_000,
    });
    const data = (await response.body.json()) as { ok?: boolean; result?: unknown; description?: string };
    if (!data.ok) throw new Error(`${method}: ${data.description ?? `HTTP ${response.statusCode}`}`);
    return data.result;
  }
}
