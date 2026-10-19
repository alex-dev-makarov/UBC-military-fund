import type { INestApplicationContext } from '@nestjs/common';

/** Test double for the Nest context: returns the given instances by class token. */
export function fakeApp(instances: ReadonlyMap<unknown, unknown>): INestApplicationContext {
  const get = (token: unknown): unknown => {
    if (!instances.has(token)) throw new Error(`fakeApp: no instance for ${String(token)}`);
    return instances.get(token);
  };
  return { get } as unknown as INestApplicationContext; // partial stand-in; commands only call get()
}
