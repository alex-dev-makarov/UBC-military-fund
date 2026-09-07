import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDOFF_PARAM, SECRET_PATH } from './paths';

const frontendConstants = readFileSync(
  join(__dirname, '../../../../../src/features/auth-telegram/model/constants.ts'),
  'utf8',
);

describe('paths shared with the frontend', () => {
  it('matches the SECRET_PATH the frontend routes on', () => {
    expect(frontendConstants).toContain(`export const SECRET_PATH = '${SECRET_PATH}'`);
  });

  it('matches the HANDOFF_PARAM the frontend reads from the query string', () => {
    expect(frontendConstants).toContain(`export const HANDOFF_PARAM = '${HANDOFF_PARAM}'`);
  });

  it('nests the secret page under the members entry path', () => {
    expect(frontendConstants).toContain("export const MEMBERS_PATH = '/members-details-ubc'");
    expect(SECRET_PATH.startsWith('/members-details-ubc/')).toBe(true);
  });
});
