import { Injectable } from '@nestjs/common';
import type {
  ChatMemberStatus,
  TelegramApiResponse,
  TelegramChatMember,
  MembershipResult,
} from './telegram.types';

@Injectable()
export class TelegramService {
  private botUsername: Promise<string> | null = null;

  getBotUsername(botToken: string): Promise<string> {
    this.botUsername ??= fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json() as Promise<TelegramApiResponse<{ username?: string }>>)
      .then((data) => {
        if (!data.ok || !data.result?.username) throw new Error('Telegram getMe failed');
        return data.result.username;
      })
      .catch((error: unknown) => {
        this.botUsername = null;
        throw error;
      });
    return this.botUsername;
  }

  /**
   * Looks up one chat member for the CLI. Resolves to Telegram's `result`, or null when the
   * envelope carries none (unknown user, bad token). Rejects on network failure, timeout or an
   * unparseable body, so callers can tell "unknown" apart from "Telegram unreachable".
   */
  async getChatMember(
    userId: number,
    chatId: number | string,
    botToken: string,
  ): Promise<TelegramChatMember | null> {
    const response = await this.fetchChatMember(userId, chatId, botToken, 8000);
    const data = (await response.json()) as TelegramApiResponse<TelegramChatMember>;
    return data.result ?? null;
  }

  private fetchChatMember(
    userId: number,
    chatId: number | string,
    botToken: string,
    timeoutMs: number,
  ): Promise<Response> {
    return fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async checkGroupMembership(userId: number, chatId: number | string, botToken: string): Promise<MembershipResult> {
    try {
      const response = await this.fetchChatMember(userId, chatId, botToken, 10000);

      if (!response.ok && response.status >= 500) {
        console.error(`Telegram API HTTP error: ${response.status}`);
        return { determined: false, reason: 'http', status: response.status };
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        console.error('Failed to parse Telegram API response as JSON');
        return { determined: false, reason: 'malformed', status: response.status };
      }

      if (
        typeof data !== 'object' ||
        data === null ||
        Array.isArray(data) ||
        typeof (data as { ok?: unknown }).ok !== 'boolean'
      ) {
        console.error('Telegram API response is not a valid Telegram envelope');
        return { determined: false, reason: 'malformed', status: response.status };
      }

      const apiResponse = data as TelegramApiResponse<TelegramChatMember>;

      if (!apiResponse.ok) {

        if (apiResponse.description) {
          console.error(`Telegram API error: ${apiResponse.description}`);
        }

        if (
          apiResponse.error_code === 400 &&
          typeof apiResponse.description === 'string' &&
          /user not found|member not found|PARTICIPANT_ID_INVALID/i.test(apiResponse.description)
        ) {
          return { determined: true, isMember: false };
        }
        return {
          determined: false,
          reason: 'api_error',
          status: response.status,
          description: apiResponse.description,
        };
      }

      if (!apiResponse.result) {
        console.error('Telegram API response missing result field');
        return { determined: false, reason: 'malformed', status: response.status };
      }

      const status: unknown = apiResponse.result.status;

      const KNOWN_STATUSES: readonly ChatMemberStatus[] = [
        'creator',
        'administrator',
        'member',
        'restricted',
        'left',
        'kicked',
      ];
      if (typeof status !== 'string' || !KNOWN_STATUSES.includes(status as ChatMemberStatus)) {
        console.error('Telegram API response has an unrecognised chat member status');
        return { determined: false, reason: 'malformed', status: response.status };
      }

      return {
        determined: true,
        isMember: status === 'creator' || status === 'administrator' || status === 'member',
      };
    } catch (error) {

      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        console.error('Telegram API request timed out');
        return { determined: false, reason: 'timeout' };
      }
      if (error instanceof Error) {
        console.error(`Telegram API request failed: ${error.message}`);
      } else {
        console.error('Telegram API request failed');
      }
      return { determined: false, reason: 'network' };
    }
  }
}
