export type ChatMemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

export interface TelegramChatMember {
  status: ChatMemberStatus;
  [key: string]: unknown;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export type MembershipResult =
  | { determined: true; isMember: boolean }
  | {
      determined: false;
      reason: 'http' | 'timeout' | 'network' | 'api_error' | 'malformed';
      status?: number;
      description?: string;
    };
