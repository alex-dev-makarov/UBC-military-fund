import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDOFF_PARAM, HANDOFF_PATH } from './paths';

// The frontend file (outside api/), which must stay in sync with paths.ts.
const frontendConstants = readFileSync(
  join(__dirname, '../../../../src/features/auth-telegram/model/constants.ts'),
  'utf8',
);

describe('paths shared with the frontend', () => {
  it('matches the HANDOFF_PATH the frontend routes the bot link to', () => {
    expect(HANDOFF_PATH).toBe('/auth/telegram');
    expect(frontendConstants).toContain(`export const HANDOFF_PATH = '${HANDOFF_PATH}'`);
  });

  it('matches the HANDOFF_PARAM the frontend reads from the URL fragment', () => {
    expect(HANDOFF_PARAM).toBe('t');
    expect(frontendConstants).toContain(`export const HANDOFF_PARAM = '${HANDOFF_PARAM}'`);
  });
});
