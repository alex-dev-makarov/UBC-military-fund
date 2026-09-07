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
