export type NonceStatus = 'pending' | 'confirming' | 'authorized' | 'denied';

export interface NonceRecord {
  nonce: string;
  expires_at: number;
  status: NonceStatus;
  telegram_id: number | null;
  origin: string | null;
  consumed_at: number | null;
  code: number | null;
  choices: string | null;
  binding_hash: string | null;
  client: string | null;
}

export interface NewNonce {
  origin?: string;
  code: number;
  choices: number[];
  bindingHash: string;
  client?: string;
}

export type ConfirmResult = 'authorized' | 'wrong' | 'invalid';
