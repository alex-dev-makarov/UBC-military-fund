import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../../shared/db';
import { NonceRepository } from './nonce.repository';

function repo(): NonceRepository {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return new NonceRepository(db);
}

const input = { code: 47, choices: [12, 47, 83], bindingHash: 'browser-a', client: 'Chrome · Mac' };

describe('NonceRepository', () => {
  it('mints unguessable, unique nonces', () => {
    const nonces = repo();
    const values = new Set(Array.from({ length: 50 }, () => nonces.create(60_000, input).nonce));
    expect(values.size).toBe(50);
    for (const value of values) expect(value.length).toBeGreaterThanOrEqual(43);
  });

  it('pending → confirming → authorized with the right number', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);

    expect(nonces.find(nonce)?.status).toBe('pending');
    expect(nonces.startConfirm(nonce, 42)).toBe(true);
    expect(nonces.find(nonce)?.status).toBe('confirming');
    expect(nonces.confirm(nonce, 42, 47)).toBe('authorized');
    expect(nonces.find(nonce)?.telegram_id).toBe(42);
  });

  it('a wrong number kills the attempt for good', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);
    nonces.startConfirm(nonce, 42);

    expect(nonces.confirm(nonce, 42, 12)).toBe('wrong');
    expect(nonces.find(nonce)?.status).toBe('denied');
    expect(nonces.confirm(nonce, 42, 47)).toBe('invalid');
  });

  it('only the Telegram user who pressed Start can confirm', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);
    nonces.startConfirm(nonce, 42);

    expect(nonces.confirm(nonce, 99, 47)).toBe('invalid');
    expect(nonces.find(nonce)?.status).toBe('confirming');
  });

  it('a second Start on the same nonce is refused', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);

    expect(nonces.startConfirm(nonce, 42)).toBe(true);
    expect(nonces.startConfirm(nonce, 99)).toBe(false);
    expect(nonces.find(nonce)?.telegram_id).toBe(42);
  });

  it('is consumed once, and only by the browser that started it', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);
    nonces.startConfirm(nonce, 42);
    nonces.confirm(nonce, 42, 47);

    expect(nonces.consume(nonce, 'browser-b')).toBeUndefined();
    expect(nonces.consume(nonce, 'browser-a')?.telegram_id).toBe(42);
    expect(nonces.consume(nonce, 'browser-a')).toBeUndefined();
  });

  it('cannot be consumed before confirmation', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, input);
    nonces.startConfirm(nonce, 42);
    expect(nonces.consume(nonce, 'browser-a')).toBeUndefined();
  });

  it('expires', () => {
    const nonces = repo();
    const { nonce } = nonces.create(-1, input);
    expect(nonces.startConfirm(nonce, 42)).toBe(false);
  });

  it('deny works from pending and confirming', () => {
    const nonces = repo();
    const a = nonces.create(60_000, input).nonce;
    const b = nonces.create(60_000, input).nonce;
    nonces.startConfirm(b, 42);

    expect(nonces.deny(a)).toBe(true);
    expect(nonces.deny(b)).toBe(true);
    expect(nonces.find(b)?.status).toBe('denied');
  });

  it('a newer Start by the same person cancels the older pending confirmation', () => {
    const nonces = repo();
    const older = nonces.create(60_000, input).nonce;
    const newer = nonces.create(60_000, input).nonce;
    nonces.startConfirm(older, 42);
    nonces.startConfirm(newer, 42);

    expect(nonces.find(older)?.status).toBe('denied');
    expect(nonces.find(newer)?.status).toBe('confirming');
  });

  it('"not me" denies every unconsumed login of that person', () => {
    const nonces = repo();
    const authorized = nonces.create(60_000, input).nonce;
    nonces.startConfirm(authorized, 42);
    nonces.confirm(authorized, 42, 47);
    const other = nonces.create(60_000, input).nonce;
    nonces.startConfirm(other, 7);

    expect(nonces.denyUnconsumedFor(42)).toBe(1);
    expect(nonces.consume(authorized, 'browser-a')).toBeUndefined();
    expect(nonces.find(other)?.status).toBe('confirming');
  });
});
