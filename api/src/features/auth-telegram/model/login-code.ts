import { createHash, randomBytes, randomInt } from 'node:crypto';

export function loginChoices(): { code: number; choices: number[] } {
  const picked = new Set<number>();
  while (picked.size < 3) picked.add(randomInt(10, 100));
  const choices = [...picked];
  return { code: choices[randomInt(0, choices.length)]!, choices: choices.sort((a, b) => a - b) };
}

export function newBinding(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashBinding(token) };
}

export function hashBinding(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
