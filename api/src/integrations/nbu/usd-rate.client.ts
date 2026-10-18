import { Injectable, Logger } from '@nestjs/common';

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json';
const TTL_MS = 7 * 24 * 60 * 60_000;
const RETRY_MS = 5 * 60_000;
const MAX_STALE_MS = 14 * 24 * 60 * 60_000;
const TIMEOUT_MS = 5_000;
const FIRST_WAIT_MS = 1_000;

@Injectable()
export class UsdRateClient {
  private readonly logger = new Logger(UsdRateClient.name);
  private cached: { value: number; at: number } | null = null;
  private lastFailureAt: number | null = null;
  private inflight: Promise<number | null> | null = null;

  get(): Promise<number | null> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < TTL_MS) return Promise.resolve(this.cached.value);
    if (this.lastFailureAt !== null && now - this.lastFailureAt < RETRY_MS) return Promise.resolve(this.fallback(now));

    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    if (this.cached) return Promise.resolve(this.fallback(now));
    return this.waitCapped(this.inflight);
  }

  private waitCapped(pending: Promise<number | null>): Promise<number | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), FIRST_WAIT_MS);
      timer.unref?.();
      void pending.then((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  }

  private async refresh(): Promise<number | null> {
    try {
      const response = await fetch(NBU_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`status ${response.status}`);

      const data = (await response.json()) as Array<{ rate?: unknown }> | null;
      const rate = Array.isArray(data) ? data[0]?.rate : undefined;
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('rate missing or invalid');
      }
      this.cached = { value: rate, at: Date.now() };
      this.lastFailureAt = null;
      return rate;
    } catch (error) {
      this.logger.warn(`usd rate fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      const now = Date.now();
      this.lastFailureAt = now;
      return this.fallback(now);
    }
  }

  private fallback(now: number): number | null {
    return this.cached && now - this.cached.at <= MAX_STALE_MS ? this.cached.value : null;
  }
}
