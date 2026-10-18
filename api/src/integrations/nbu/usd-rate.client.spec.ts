import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsdRateClient } from './usd-rate.client';

const DAY = 24 * 60 * 60_000;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const nbu = (rate: unknown) => ok([{ rate, cc: 'USD', exchangedate: '19.10.2026' }]);

describe('UsdRateClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('parses the NBU rate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(nbu(44.8625)));

    expect(await new UsdRateClient().get()).toBe(44.8625);
  });

  it('serves from cache within the TTL, then returns the stale rate at once and refreshes in the background', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(nbu(44)).mockResolvedValue(nbu(45));
    vi.stubGlobal('fetch', fetchMock);
    const service = new UsdRateClient();

    await service.get();
    vi.advanceTimersByTime(6 * DAY);
    await service.get();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * DAY);
    expect(await service.get()).toBe(44);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(0);
    expect(await service.get()).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps the first call at 1s when upstream is slow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const service = new UsdRateClient();

    const pending = service.get();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toBeNull();
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(nbu(44));
    vi.stubGlobal('fetch', fetchMock);
    const service = new UsdRateClient();

    await Promise.all([service.get(), service.get()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call upstream during the retry window after a failure, then retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new UsdRateClient();

    expect(await service.get()).toBeNull();
    await service.get();
    vi.advanceTimersByTime(4 * 60_000);
    await service.get();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * 60_000);
    await service.get();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the last good rate on failure until it is 14 days old', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(nbu(44)).mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new UsdRateClient();

    await service.get();
    vi.advanceTimersByTime(8 * DAY);
    expect(await service.get()).toBe(44);

    vi.advanceTimersByTime(7 * DAY);
    expect(await service.get()).toBeNull();
  });

  it.each([[{}], [[]], [[{ rate: 'x' }]], [[{ rate: 0 }]], [[{ rate: -1 }]], [[{ rate: null }]]])(
    'returns null for a bad payload %j',
    async (payload) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(payload)));

      expect(await new UsdRateClient().get()).toBeNull();
    },
  );

  it('returns null on a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));

    expect(await new UsdRateClient().get()).toBeNull();
  });
});
