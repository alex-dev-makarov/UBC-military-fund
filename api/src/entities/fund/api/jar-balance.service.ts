import { Injectable, Logger } from '@nestjs/common';
import { FundRepository } from './fund.repository';

export interface JarBalance {
  amount: number | null;
  name: string | null;
}

const HANDLER_URL = 'https://send.monobank.ua/api/handler';
const TTL_MS = 15_000;
const RETRY_MS = 60_000;
const MAX_STALE_MS = 15 * 60_000;
const TIMEOUT_MS = 5_000;
const EMPTY: JarBalance = { amount: null, name: null };

const toUah = (kopecks: number) => Math.round(kopecks) / 100;

@Injectable()
export class JarBalanceService {
  private readonly logger = new Logger(JarBalanceService.name);
  private cached: { value: JarBalance; at: number } | null = null;
  private lastFailureAt: number | null = null;
  private inflight: Promise<JarBalance> | null = null;

  constructor(private readonly fund: FundRepository) {}

  get(): Promise<JarBalance> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < TTL_MS) return Promise.resolve(this.cached.value);
    if (this.lastFailureAt !== null && now - this.lastFailureAt < RETRY_MS) return Promise.resolve(this.fallback(now));
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async refresh(): Promise<JarBalance> {
    try {
      const sendId = new URL(this.fund.getMeta('jarUrl') ?? '').pathname.split('/').filter(Boolean).pop();
      if (!sendId) throw new Error('jarUrl has no send id');

      const response = await fetch(HANDLER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ c: 'hello', clientId: sendId, Pc: 'BKA', referer: '' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);

      const data = (await response.json()) as { jarAmount?: unknown; name?: unknown };
      if (typeof data.jarAmount !== 'number' || !Number.isFinite(data.jarAmount)) {
        throw new Error('jarAmount missing or not a number');
      }
      const value: JarBalance = {
        amount: toUah(data.jarAmount),
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 120) : null,
      };
      this.cached = { value, at: Date.now() };
      this.lastFailureAt = null;
      return value;
    } catch (error) {
      this.logger.warn(`jar balance fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      const now = Date.now();
      this.lastFailureAt = now;
      return this.fallback(now);
    }
  }

  private fallback(now: number): JarBalance {
    return this.cached && now - this.cached.at <= MAX_STALE_MS ? this.cached.value : EMPTY;
  }
}
