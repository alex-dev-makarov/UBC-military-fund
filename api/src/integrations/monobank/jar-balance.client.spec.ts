import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JarBalanceClient } from './jar-balance.client';

const JAR_URL = 'https://send.monobank.ua/jar/8wj2DmvhZw';
const getJarUrl = (): string => JAR_URL;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('JarBalanceClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('converts kopecks to UAH and posts the send id from jarUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ jarAmount: 3161262, name: 'На спорядження' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await new JarBalanceClient().get(getJarUrl)).toEqual({ amount: 31612.62, name: 'На спорядження' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).clientId).toBe('8wj2DmvhZw');
  });

  it('serves from cache within the TTL and refetches after it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ jarAmount: 100 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await service.get(getJarUrl);
    vi.advanceTimersByTime(14_000);
    await service.get(getJarUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await service.get(getJarUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ jarAmount: 100 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await Promise.all([service.get(getJarUrl), service.get(getJarUrl)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the last good value when a later fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ jarAmount: 500 }))
      .mockRejectedValueOnce(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await service.get(getJarUrl);
    vi.advanceTimersByTime(61_000);
    expect(await service.get(getJarUrl)).toEqual({ amount: 5, name: null });
  });

  it('returns nulls when it never succeeded, including on a malformed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ jarAmount: 'x' })));

    expect(await new JarBalanceClient().get(getJarUrl)).toEqual({ amount: null, name: null });
  });

  it('returns nulls on a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));

    expect(await new JarBalanceClient().get(getJarUrl)).toEqual({ amount: null, name: null });
  });

  it('returns nulls when fetch rejects and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    expect(await new JarBalanceClient().get(getJarUrl)).toEqual({ amount: null, name: null });
  });

  it('does not hammer upstream after a failure past the TTL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ jarAmount: 500 }))
      .mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await service.get(getJarUrl);
    vi.advanceTimersByTime(61_000);
    await service.get(getJarUrl);
    await service.get(getJarUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a cached value older than the stale limit when upstream keeps failing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ jarAmount: 500 }))
      .mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await service.get(getJarUrl);
    vi.advanceTimersByTime(16 * 60_000);
    expect(await service.get(getJarUrl)).toEqual({ amount: null, name: null });
  });

  it('retries after the failure window', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(ok({ jarAmount: 700 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new JarBalanceClient();

    await service.get(getJarUrl);
    vi.advanceTimersByTime(61_000);
    expect(await service.get(getJarUrl)).toEqual({ amount: 7, name: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(61_000);
    await service.get(getJarUrl);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('resolves to the fallback when the jar URL getter throws', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const getter = vi.fn((): string | null => {
      throw new Error('db down');
    });

    await expect(new JarBalanceClient().get(getter)).resolves.toEqual({ amount: null, name: null });
    expect(getter).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the jar URL getter on a cache hit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ jarAmount: 100 })));
    const getter = vi.fn(() => JAR_URL);
    const service = new JarBalanceClient();

    await service.get(getter);
    await service.get(getter);
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it.each([
    [123, null],
    ['', null],
    ['   ', null],
    ['  Збір  ', 'Збір'],
    ['x'.repeat(200), 'x'.repeat(120)],
  ])('normalizes jar name %j to %j', async (name, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ jarAmount: 100, name })));

    expect((await new JarBalanceClient().get(getJarUrl)).name).toBe(expected);
  });
});
