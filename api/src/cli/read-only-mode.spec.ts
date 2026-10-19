import { describe, expect, it } from 'vitest';
import { applyReadOnlyMode } from './read-only-mode';

describe('applyReadOnlyMode', () => {
  it('clears an inherited DB_READONLY for a write command', () => {
    const env: NodeJS.ProcessEnv = { DB_READONLY: '1' };
    applyReadOnlyMode(env, {});
    expect(env.DB_READONLY).toBeUndefined();
  });

  it('sets DB_READONLY for a read-only command', () => {
    const env: NodeJS.ProcessEnv = {};
    applyReadOnlyMode(env, { readOnly: true });
    expect(env.DB_READONLY).toBe('1');
  });
});
