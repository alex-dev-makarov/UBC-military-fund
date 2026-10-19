import { describe, expect, it, vi } from 'vitest';
import { TelegramService } from './telegram.service';

const BOT_TOKEN = '123456:AAH-test-token';

describe('TelegramService.checkGroupMembership', () => {
  const CHAT = '-1001234567890';

  function stubFetch(response: unknown, init: { status?: number; ok?: boolean } = {}) {
    const status = init.status ?? 200;
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: init.ok ?? status < 400,
      status,
      json: async () => response,
    } as Response);
  }

  it.each(['member', 'administrator', 'creator'])('treats %s as a member', async (status) => {
    stubFetch({ ok: true, result: { status } });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toEqual({ determined: true, isMember: true });
  });

  it.each(['left', 'kicked', 'restricted'])('treats %s as not a member', async (status) => {
    stubFetch({ ok: true, result: { status } });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toEqual({ determined: true, isMember: false });
  });

  it('reads "user not found" as an authoritative non-member', async () => {
    stubFetch({ ok: false, error_code: 400, description: 'Bad Request: user not found' }, { status: 400 });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toEqual({ determined: true, isMember: false });
  });

  it.each([
    'Bad Request: user not found',
    'Bad Request: member not found',
    'Bad Request: PARTICIPANT_ID_INVALID',
  ])('reads %s as an authoritative non-member', async (description) => {
    stubFetch({ ok: false, error_code: 400, description }, { status: 400 });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toEqual({ determined: true, isMember: false });
  });

  it('reports a misconfigured chat id as undetermined, not as a non-member', async () => {
    stubFetch({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, { status: 400 });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toMatchObject({ determined: false, reason: 'api_error', status: 400 });
  });

  it('classifies a 5xx as a retryable transport failure', async () => {
    stubFetch({}, { status: 502 });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toMatchObject({ determined: false, reason: 'http' });
  });

  it('classifies an unrecognised body as malformed', async () => {
    stubFetch({ ok: true, result: { status: 'brand_new_status' } });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(result).toMatchObject({ determined: false, reason: 'malformed' });
  });

  it('never leaks the bot token in the returned failure', async () => {
    stubFetch({}, { status: 500 });
    const result = await new TelegramService().checkGroupMembership(1, CHAT, BOT_TOKEN);
    expect(JSON.stringify(result)).not.toContain('AAH-test-token');
  });
});

describe('TelegramService.getBotUsername', () => {
  it('asks Telegram once and caches the answer', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true, result: { username: 'my_bot' } }),
    } as Response);
    const telegram = new TelegramService();

    expect(await telegram.getBotUsername(BOT_TOKEN)).toBe('my_bot');
    expect(await telegram.getBotUsername(BOT_TOKEN)).toBe('my_bot');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure, so the next login retries', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { username: 'my_bot' } }) } as Response);
    const telegram = new TelegramService();

    await expect(telegram.getBotUsername(BOT_TOKEN)).rejects.toThrow();
    expect(await telegram.getBotUsername(BOT_TOKEN)).toBe('my_bot');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('TelegramService.getChatMember', () => {
  const CHAT = '-1001234567890';

  it('posts chat and user ids to the token-scoped endpoint and returns the result', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({
        ok: true,
        result: { status: 'member', user: { first_name: 'Ada', last_name: 'Lovelace', username: 'ada' } },
      }),
    } as Response);

    const result = await new TelegramService().getChatMember(42, CHAT, BOT_TOKEN);

    expect(result).toEqual({
      status: 'member',
      user: { first_name: 'Ada', last_name: 'Lovelace', username: 'ada' },
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ chat_id: CHAT, user_id: 42 });
  });

  it('resolves to null when the envelope carries no result (unknown user or bad token)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }),
    } as Response);

    await expect(new TelegramService().getChatMember(42, CHAT, BOT_TOKEN)).resolves.toBeNull();
  });

  it('rejects on network failure so callers can tell it from an unknown user', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(new TelegramService().getChatMember(42, CHAT, BOT_TOKEN)).rejects.toThrow('fetch failed');
  });

  it('rejects when the body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    await expect(new TelegramService().getChatMember(42, CHAT, BOT_TOKEN)).rejects.toThrow(SyntaxError);
  });
});
