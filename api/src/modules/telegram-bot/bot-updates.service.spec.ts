import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { BotUpdatesService } from './bot-updates.service';

const CHAT = 42;
const TG_ID = 111;
const NONCE = 'abcdefghijklmnopqrstuvwxyz';
const MESSAGE = { message_id: 5, chat: { id: CHAT } };
const LINK_LABEL = 'Відкрити закритий звіт';
const NOT_ME = { text: 'Це не я — вийти всюди', callback_data: 'revoke' };
const CONFIG: Record<string, unknown> = {
  PUBLIC_SITE_URL: 'https://site.example',
  TELEGRAM_BOT_POLLING: false,
};

// The dispatch methods are private; they are driven directly here so the poll loop never starts.
type Dispatch = {
  handleMessage(message: unknown): Promise<void>;
  handleCallback(query: unknown): Promise<void>;
};

describe('BotUpdatesService dispatch', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let bot: { send: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn>; answer: ReturnType<typeof vi.fn>; call: ReturnType<typeof vi.fn> };
  let expenses: { handleFile: ReturnType<typeof vi.fn>; handleMessage: ReturnType<typeof vi.fn>; handleCallback: ReturnType<typeof vi.fn> };
  let auth: { beginConfirm: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn>; revokeAll: ReturnType<typeof vi.fn> };
  let dispatch: Dispatch;

  const privateMessage = (text: string) => ({ from: { id: TG_ID }, chat: { id: CHAT, type: 'private' }, text });
  const callback = (data: string) => ({ id: 'q1', from: { id: TG_ID }, data, message: MESSAGE });

  beforeEach(() => {
    config = { get: vi.fn((key: string) => CONFIG[key]) };
    bot = {
      send: vi.fn(async () => undefined),
      edit: vi.fn(async () => undefined),
      answer: vi.fn(async () => undefined),
      call: vi.fn(async () => undefined),
    };
    expenses = {
      handleFile: vi.fn(async () => false),
      handleMessage: vi.fn(async () => false),
      handleCallback: vi.fn(async () => false),
    };
    auth = { beginConfirm: vi.fn(), pick: vi.fn(), revokeAll: vi.fn() };
    const service = new BotUpdatesService(config as never, bot as never, expenses as never, auth as never);
    dispatch = service as unknown as Dispatch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('/start', () => {
    it('replies that the link is stale', async () => {
      auth.beginConfirm.mockResolvedValue({ kind: 'stale' });
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      expect(auth.beginConfirm).toHaveBeenCalledWith(NONCE, TG_ID);
      expect(bot.send).toHaveBeenCalledWith(CHAT, 'Посилання застаріло. Поверніться на сайт і спробуйте ще раз.', undefined);
    });

    it('replies that the account is not in the group', async () => {
      auth.beginConfirm.mockResolvedValue({ kind: 'not-member' });
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      expect(bot.send).toHaveBeenCalledWith(CHAT, 'Цей акаунт не в закритій групі — доступ не надано.', undefined);
    });

    it('replies that membership is undetermined and logs a warning', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      auth.beginConfirm.mockResolvedValue({ kind: 'unavailable', reason: 'timeout' });
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      expect(warn).toHaveBeenCalledWith(`membership undetermined (timeout) for ${TG_ID}`);
      expect(bot.send).toHaveBeenCalledWith(CHAT, 'Не вдалося перевірити доступ. Спробуйте ще раз за хвилину.', undefined);
    });

    it('replies that the link was already used', async () => {
      auth.beginConfirm.mockResolvedValue({ kind: 'used' });
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      expect(bot.send).toHaveBeenCalledWith(CHAT, 'Посилання вже використане. Поверніться на сайт і спробуйте ще раз.', undefined);
    });

    it('sends the number keyboard with c:<nonce>:<n> callback data when confirmation starts', async () => {
      auth.beginConfirm.mockResolvedValue({ kind: 'ok', client: null, choices: ['1', '2', '3'] });
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      const [, text, keyboard] = bot.send.mock.calls[0]!;
      expect(text).toContain('Вхід на site.example з пристрою: невідомий браузер.');
      expect(keyboard).toEqual([
        [
          { text: '1', callback_data: `c:${NONCE}:1` },
          { text: '2', callback_data: `c:${NONCE}:2` },
          { text: '3', callback_data: `c:${NONCE}:3` },
        ],
      ]);
    });

    it('lets expense handlers take the message first', async () => {
      expenses.handleMessage.mockResolvedValue(true);
      await dispatch.handleMessage(privateMessage(`/start ${NONCE}`));
      expect(auth.beginConfirm).not.toHaveBeenCalled();
    });
  });

  describe('pick callbacks', () => {
    it('edits the message for a wrong number', async () => {
      auth.pick.mockReturnValue({ kind: 'wrong' });
      await dispatch.handleCallback(callback(`c:${NONCE}:02`));
      expect(bot.answer).toHaveBeenCalledWith('q1');
      expect(auth.pick).toHaveBeenCalledWith(NONCE, TG_ID, 2);
      expect(bot.edit).toHaveBeenCalledWith(
        MESSAGE,
        expect.stringContaining('Число не збіглося — вхід скасовано.'),
        undefined,
      );
    });

    it('edits the message for a stale pick', async () => {
      auth.pick.mockReturnValue({ kind: 'invalid' });
      await dispatch.handleCallback(callback(`c:${NONCE}:01`));
      expect(bot.edit).toHaveBeenCalledWith(MESSAGE, 'Посилання застаріло. Поверніться на сайт і спробуйте ще раз.', undefined);
    });

    it('puts an https link on a button', async () => {
      const link = 'https://site.example/auth/telegram#t=abc';
      auth.pick.mockReturnValue({ kind: 'ok', client: 'Safari', link });
      await dispatch.handleCallback(callback(`c:${NONCE}:01`));
      const [, text, keyboard] = bot.edit.mock.calls[0]!;
      expect(text).toContain('✅ Новий вхід: Safari, ');
      expect(text).not.toContain(link);
      expect(keyboard).toEqual([[{ text: LINK_LABEL, url: link }], [NOT_ME]]);
    });

    it('puts a non-https link in the text instead of a button', async () => {
      const link = 'http://localhost:3000/auth/telegram#t=abc';
      auth.pick.mockReturnValue({ kind: 'ok', client: null, link });
      await dispatch.handleCallback(callback(`c:${NONCE}:01`));
      const [, text, keyboard] = bot.edit.mock.calls[0]!;
      expect(text).toContain('✅ Новий вхід: невідомий браузер, ');
      expect(text).toContain(`\n\n${LINK_LABEL}: ${link}`);
      expect(keyboard).toEqual([[NOT_ME]]);
    });
  });

  describe('revoke callback', () => {
    it('revokes all sessions for the user and confirms in the message', async () => {
      await dispatch.handleCallback(callback('revoke'));
      expect(auth.revokeAll).toHaveBeenCalledWith(TG_ID);
      expect(bot.edit).toHaveBeenCalledWith(
        MESSAGE,
        expect.stringContaining('Усі ваші сесії на сайті завершено, незабрані входи скасовано.'),
        undefined,
      );
    });

    it('ignores callbacks without a message', async () => {
      await dispatch.handleCallback({ id: 'q1', from: { id: TG_ID }, data: 'revoke' });
      expect(bot.answer).toHaveBeenCalledWith('q1');
      expect(auth.revokeAll).not.toHaveBeenCalled();
    });

    it('lets expense callbacks take the query first', async () => {
      expenses.handleCallback.mockResolvedValue(true);
      await dispatch.handleCallback(callback('revoke'));
      expect(bot.answer).not.toHaveBeenCalled();
      expect(auth.revokeAll).not.toHaveBeenCalled();
    });
  });
});
