import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetentionService } from './retention.service';

function build() {
  const views = { purgeBefore: vi.fn(() => 0) };
  const securityLog = { purgeBefore: vi.fn(() => 0) };
  const config = { get: () => 180 };
  const service = new RetentionService(views as never, securityLog as never, config as never);
  return { service, views, securityLog };
}

describe('RetentionService.onModuleInit', () => {
  afterEach(() => {
    delete process.env.DB_READONLY;
    vi.restoreAllMocks();
  });

  it('purges on boot in normal mode', () => {
    const { service, views, securityLog } = build();
    service.onModuleInit();
    service.onModuleDestroy();
    expect(views.purgeBefore).toHaveBeenCalledTimes(1);
    expect(securityLog.purgeBefore).toHaveBeenCalledTimes(1);
  });

  it('skips the purge and the timer in read-only mode', () => {
    process.env.DB_READONLY = '1';
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const { service, views, securityLog } = build();
    service.onModuleInit();
    service.onModuleDestroy();
    expect(views.purgeBefore).not.toHaveBeenCalled();
    expect(securityLog.purgeBefore).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
