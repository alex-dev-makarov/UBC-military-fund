export type NonceStatus = 'pending' | 'authorized' | 'denied';

export interface NonceRecord {
  nonce: string;
  expires_at: number;
  status: NonceStatus;
  telegram_id: number | null;
  origin: string | null;
  consumed_at: number | null;
}
