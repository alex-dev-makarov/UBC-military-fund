import { describe, expect, it } from 'vitest';
import { hashBinding, loginChoices, newBinding } from './login-code';

describe('loginChoices', () => {
  it('gives three distinct two-digit numbers, one of them the code', () => {
    for (let i = 0; i < 200; i += 1) {
      const { code, choices } = loginChoices();
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(code);
      for (const n of choices) expect(n >= 10 && n <= 99).toBe(true);
      expect([...choices].sort((a, b) => a - b)).toEqual(choices);
    }
  });
});

describe('newBinding', () => {
  it('stores only a hash of the browser token', () => {
    const { token, hash } = newBinding();
    expect(hash).not.toBe(token);
    expect(hashBinding(token)).toBe(hash);
  });
});
