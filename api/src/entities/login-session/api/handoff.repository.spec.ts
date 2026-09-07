import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../../../shared/db';
import { HandoffRepository } from './handoff.repository';

function repo(): HandoffRepository {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return new HandoffRepository(db);
}

describe('HandoffRepository', () => {
  it('mints unique, unguessable tokens', () => {
    const handoffs = repo();
    const tokens = new Set(Array.from({ length: 50 }, () => handoffs.create(1, 60_000)));

    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('returns the telegram id exactly once', () => {



    const handoffs = repo();
    const token = handoffs.create(42, 60_000);

    expect(handoffs.consume(token)).toBe(42);
    expect(handoffs.consume(token)).toBeUndefined();
  });

  it('refuses an unknown token', () => {
    expect(repo().consume('never-issued')).toBeUndefined();
  });

  it('refuses an expired token', () => {
    const handoffs = repo();
    const token = handoffs.create(42, -1);
    expect(handoffs.consume(token)).toBeUndefined();
  });

  it('keeps tokens for different users apart', () => {
    const handoffs = repo();
    const a = handoffs.create(1, 60_000);
    const b = handoffs.create(2, 60_000);

    expect(handoffs.consume(a)).toBe(1);
    expect(handoffs.consume(b)).toBe(2);
  });

  it('sweeps expired tokens on the next create', () => {
    const handoffs = repo();
    const stale = handoffs.create(1, -1);
    handoffs.create(2, 60_000);
    expect(handoffs.consume(stale)).toBeUndefined();
  });
});

describe('HandoffRepository.peek', () => {
  it('reads the telegram id without spending the token', () => {
    const handoffs = repo();
    const token = handoffs.create(42, 60_000);

    expect(handoffs.peek(token)).toBe(42);
    expect(handoffs.peek(token)).toBe(42);
    expect(handoffs.consume(token)).toBe(42);
  });

  it('returns undefined once the token is spent', () => {
    const handoffs = repo();
    const token = handoffs.create(42, 60_000);
    handoffs.consume(token);

    expect(handoffs.peek(token)).toBeUndefined();
  });

  it('returns undefined for an expired token', () => {
    const handoffs = repo();
    expect(handoffs.peek(handoffs.create(42, -1))).toBeUndefined();
  });
});
