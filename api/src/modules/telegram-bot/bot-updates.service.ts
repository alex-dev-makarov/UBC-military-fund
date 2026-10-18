import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnv } from '../../shared/config/env.types';
import { BotApi, type Keyboard } from '../../integrations/telegram';
import { BotLoginService } from '../auth';
import { ExpenseBotService } from '../expense-bot';

const LINK_LABEL = 'Відкрити закритий звіт';
const REVOKE = 'revoke';
const PICK = /^c:([A-Za-z0-9_-]{20,64}):(\d{2})$/;

interface TelegramUser {
  id: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_size?: number }>;
    document?: { file_id: string; file_name?: string; mime_type?: string };
    chat?: { id: number; type?: string };
    from?: TelegramUser;
  };
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

@Injectable()
export class BotUpdatesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotUpdatesService.name);
  private offset = 0;
  private running = false;
  private loop?: Promise<void>;

  constructor(
    private readonly config: ConfigService<ValidatedEnv, true>,
    private readonly bot: BotApi,
    private readonly expenses: ExpenseBotService,
    private readonly auth: BotLoginService,
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
    await this.loop?.catch(() => undefined);
  }

  private get token(): string {
    return this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
  }

  private async poll(): Promise<void> {
    await this.request('deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);

    while (this.running) {
      try {
        const updates = (await this.request('getUpdates', {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        })) as TelegramUpdate[] | undefined;

        for (const update of updates ?? []) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          if (update.callback_query) await this.handleCallback(update.callback_query);
          else await this.handleMessage(update.message);
        }
      } catch (error) {
        if (!this.running) return;
        this.logger.error(`getUpdates failed: ${error instanceof Error ? error.message : error}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async handleMessage(message: TelegramUpdate['message']): Promise<void> {
    const from = message?.from;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    if (!from || !chatId || message?.chat?.type !== 'private') return;
    const photo = message.photo?.at(-1);
    const file = message.document
      ? { fileId: message.document.file_id, name: message.document.file_name, mime: message.document.mime_type }
      : photo
        ? { fileId: photo.file_id, mime: 'image/jpeg' }
        : null;
    if (file) {
      await this.expenses.handleFile(from.id, chatId, file);
      return;
    }
    if (!text) return;
    if (await this.expenses.handleMessage(from.id, chatId, text)) return;

    const match = /^\/start(?:@\w+)?\s+(\S+)$/.exec(text);
    if (!match) {
      if (/^\/start\b/.test(text)) {
        await this.send(chatId, 'Відкрийте вхід із сайту — там кнопка згенерує посилання.');
      }
      return;
    }

    const nonce = match[1]!;
    const result = await this.auth.beginConfirm(nonce, from.id);
    switch (result.kind) {
      case 'stale':
        await this.send(chatId, 'Посилання застаріло. Поверніться на сайт і спробуйте ще раз.');
        return;
      case 'unavailable':
        this.logger.warn(`membership undetermined (${result.reason}) for ${from.id}`);
        await this.send(chatId, 'Не вдалося перевірити доступ. Спробуйте ще раз за хвилину.');
        return;
      case 'not-member':
        await this.send(chatId, 'Цей акаунт не в закритій групі — доступ не надано.');
        return;
      case 'used':
        await this.send(chatId, 'Посилання вже використане. Поверніться на сайт і спробуйте ще раз.');
        return;
      case 'ok':
        await this.send(
          chatId,
          `Вхід на ${this.siteHost()} з пристрою: ${result.client ?? 'невідомий браузер'}.\n\n` +
            'Натисніть число, яке зараз показує сайт.\n\n' +
            '⚠️ Якщо ви не входили на сайт щойно — нічого не натискайте.',
          [result.choices.map((n) => ({ text: n, callback_data: `c:${nonce}:${n}` }))],
        );
        return;
    }
  }

  private async handleCallback(query: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
    if (await this.expenses.handleCallback(query)) return;
    await this.bot.answer(query.id);
    const message = query.message;
    if (!message) return;

    const pick = PICK.exec(query.data ?? '');
    if (pick) {
      await this.handlePick(query.from.id, message, pick[1]!, Number(pick[2]));
      return;
    }
    if (query.data !== REVOKE) return;

    this.auth.revokeAll(query.from.id);
    await this.edit(
      message,
      'Усі ваші сесії на сайті завершено, незабрані входи скасовано.\n\n' +
        'Якщо вам підказували число або просили натиснути посилання — повідомте координатора.',
    );
  }

  private async handlePick(
    telegramId: number,
    message: { message_id: number; chat: { id: number } },
    nonce: string,
    picked: number,
  ): Promise<void> {
    const result = this.auth.pick(nonce, telegramId, picked);
    if (result.kind === 'invalid') {
      await this.edit(message, 'Посилання застаріло. Поверніться на сайт і спробуйте ще раз.');
      return;
    }
    if (result.kind === 'wrong') {
      await this.edit(
        message,
        'Число не збіглося — вхід скасовано.\n\nЯкщо ви не входили на сайт, нічого робити не потрібно. ' +
          'Якщо входили — почніть вхід на сайті ще раз.',
      );
      return;
    }

    const { link } = result;
    const time = new Date().toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
    const text =
      `✅ Новий вхід: ${result.client ?? 'невідомий браузер'}, ${time}.\n\n` +
      'Поверніться на сайт — він відкриється сам. Посилання нижче особисте й одноразове, не пересилайте його.\n\n' +
      'Якщо це були не ви — натисніть «Це не я»: усі ваші сесії буде завершено.';
    const notMe = { text: 'Це не я — вийти всюди', callback_data: REVOKE };
    if (link.startsWith('https://')) {
      await this.edit(message, text, [[{ text: LINK_LABEL, url: link }], [notMe]]);
    } else {
      await this.edit(message, `${text}\n\n${LINK_LABEL}: ${link}`, [[notMe]]);
    }
  }

  private siteHost(): string {
    return new URL(this.config.get('PUBLIC_SITE_URL', { infer: true })).host;
  }

  private send(chatId: number, text: string, keyboard?: Keyboard): Promise<unknown> {
    return this.bot.send(chatId, text, keyboard);
  }

  private edit(message: { message_id: number; chat: { id: number } }, text: string, keyboard?: Keyboard): Promise<unknown> {
    return this.bot.edit(message, text, keyboard);
  }

  private request(method: string, body: unknown): Promise<unknown> {
    return this.bot.call(method, body);
  }
}
