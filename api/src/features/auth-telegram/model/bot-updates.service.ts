import { Agent, request as undiciRequest } from 'undici';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../../shared/config/env.types';
import { NonceRepository, HandoffRepository } from '../../../entities/login-session';
import { HANDOFF_PARAM, SECRET_PATH } from './paths';
import { TelegramService } from '../../../shared/telegram';

const LINK_LABEL = 'Відкрити закритий звіт';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number; type?: string };
    from?: TelegramUser;
  };
}

@Injectable()
export class BotUpdatesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotUpdatesService.name);
  private offset = 0;
  private running = false;
  private loop?: Promise<void>;

  private readonly dispatcher = new Agent({ connections: 4, pipelining: 0 });

  constructor(
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly nonces: NonceRepository,
    private readonly handoffs: HandoffRepository,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('TELEGRAM_BOT_POLLING', { infer: true })) {
      this.logger.log('bot polling disabled (TELEGRAM_BOT_POLLING=false)');
      return;
    }
    this.running = true;
    this.loop = this.poll();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.dispatcher.close().catch(() => undefined);

    await this.loop?.catch(() => undefined);
  }

  private async poll(): Promise<void> {
    const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });

    await this.request(token, 'deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);

    while (this.running) {
      try {
        const updates = (await this.request(token, 'getUpdates', {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ['message'],
        })) as TelegramUpdate[] | undefined;

        for (const update of updates ?? []) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          await this.handle(update, token);
        }
      } catch (error) {
        if (!this.running) return;
        this.logger.error(`getUpdates failed: ${error instanceof Error ? error.message : error}`);

        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async handle(update: TelegramUpdate, token: string): Promise<void> {
    const message = update.message;
    const from = message?.from;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();

    if (!from || !chatId || !text) return;

    if (message.chat?.type !== 'private') return;

    const match = /^\/start(?:@\w+)?\s+(\S+)$/.exec(text);
    if (!match) {
      if (/^\/start\b/.test(text)) {
        await this.reply(token, chatId, 'Відкрийте вхід із сайту — там кнопка згенерує посилання.');
      }
      return;
    }

    const nonce = match[1]!;
    const record = this.nonces.find(nonce);

    if (!record || record.status !== 'pending' || record.expires_at <= Date.now()) {
      await this.reply(token, chatId, 'Посилання застаріло. Поверніться на сайт і спробуйте ще раз.');
      return;
    }

    const chat = this.config.get('TELEGRAM_CHAT_ID', { infer: true });
    const membership = await this.telegram.checkGroupMembership(from.id, chat, token);

    if (!membership.determined) {

      this.logger.warn(`membership undetermined (${membership.reason}) for ${from.id}`);
      await this.reply(token, chatId, 'Не вдалося перевірити доступ. Спробуйте ще раз за хвилину.');
      return;
    }

    if (!membership.isMember) {
      this.nonces.deny(nonce);
      await this.reply(token, chatId, 'Цей акаунт не в закритій групі — доступ не надано.');
      return;
    }

    const authorized = this.nonces.authorize(nonce, from.id);

    if (!authorized) {
      await this.reply(token, chatId, 'Посилання вже використане. Поверніться на сайт і спробуйте ще раз.');
      return;
    }

    await this.reply(token, chatId, 'Готово — доступ відкрито.', this.handoffLink(from.id, record.origin));
  }

  private handoffLink(telegramId: number, origin: string | null): string {
    const site: string = origin ?? this.config.get('PUBLIC_SITE_URL', { infer: true });

    const ttlSec = this.config.get('LOGIN_NONCE_TTL_SEC', { infer: true });
    const handoff = this.handoffs.create(telegramId, ttlSec * 1000, site);
    return `${site}${SECRET_PATH}?${HANDOFF_PARAM}=${encodeURIComponent(handoff)}`;
  }

  private reply(token: string, chatId: number, text: string, url?: string): Promise<unknown> {
    const escaped = url?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const body =
      url === undefined
        ? { chat_id: chatId, text }
        : url.startsWith('https://')
          ? {
              chat_id: chatId,
              text,
              reply_markup: { inline_keyboard: [[{ text: LINK_LABEL, url }]] },
            }
          : {
              chat_id: chatId,
              parse_mode: 'HTML',
              text: `${text}\n\n<a href="${escaped}">${LINK_LABEL}</a>`,
            };

    return this.request(token, 'sendMessage', body).catch((error) => {
      this.logger.warn(`sendMessage failed: ${error instanceof Error ? error.message : error}`);
    });
  }

  private async request(token: string, method: string, body: unknown): Promise<unknown> {
    const response = await undiciRequest(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      headersTimeout: 30_000,
      bodyTimeout: 30_000,
    });

    const data = (await response.body.json()) as {
      ok?: boolean;
      result?: unknown;
      description?: string;
    };
    if (!data.ok) throw new Error(`${method}: ${data.description ?? `HTTP ${response.statusCode}`}`);
    return data.result;
  }
}
