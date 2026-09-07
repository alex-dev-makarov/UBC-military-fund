import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../../../shared/db';
import { NonceRepository } from './nonce.repository';

function repo(): NonceRepository {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return new NonceRepository(db);
}

describe('NonceRepository', () => {
  it('mints unguessable, unique nonces', () => {
    const nonces = repo();
    const values = new Set(Array.from({ length: 50 }, () => nonces.create(60_000).nonce));

    expect(values.size).toBe(50);


    for (const value of values) expect(value.length).toBeGreaterThanOrEqual(43);
  });

  it('starts pending and becomes authorized', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000);

    expect(nonces.find(nonce)?.status).toBe('pending');
    expect(nonces.authorize(nonce, 42)).toBe(true);
    expect(nonces.find(nonce)?.status).toBe('authorized');
    expect(nonces.find(nonce)?.telegram_id).toBe(42);
  });

  it('can be consumed exactly once', () => {

    const nonces = repo();
    const { nonce } = nonces.create(60_000);
    nonces.authorize(nonce, 42);

    expect(nonces.consume(nonce)?.telegram_id).toBe(42);
    expect(nonces.consume(nonce)).toBeUndefined();
  });

  it('refuses to authorize an already-authorized nonce', () => {


    const nonces = repo();
    const { nonce } = nonces.create(60_000);

    expect(nonces.authorize(nonce, 42)).toBe(true);
    expect(nonces.authorize(nonce, 99)).toBe(false);
    expect(nonces.find(nonce)?.telegram_id).toBe(42);
  });

  it('refuses to authorize a denied nonce', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000);

    expect(nonces.deny(nonce)).toBe(true);
    expect(nonces.authorize(nonce, 42)).toBe(false);
    expect(nonces.find(nonce)?.status).toBe('denied');
  });

  it('refuses to authorize or consume an expired nonce', () => {
    const nonces = repo();
    const { nonce } = nonces.create(-1);

    expect(nonces.authorize(nonce, 42)).toBe(false);
    expect(nonces.consume(nonce)).toBeUndefined();
  });

  it('cannot consume a nonce that was never authorized', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000);

    expect(nonces.consume(nonce)).toBeUndefined();
  });

  it('sweeps expired nonces on the next create', () => {
    const nonces = repo();
    const { nonce } = nonces.create(-1);
    nonces.create(60_000);

    expect(nonces.find(nonce)).toBeUndefined();
  });

  it('returns undefined for an unknown nonce', () => {
    expect(repo().find('not-a-real-nonce')).toBeUndefined();
  });
});

describe('NonceRepository origin', () => {
  it('stores the origin the login was started from', () => {
    const nonces = repo();
    const { nonce } = nonces.create(60_000, 'https://tunnel.example');

    expect(nonces.find(nonce)?.origin).toBe('https://tunnel.example');
  });

  it('stores null when no origin was supplied', () => {
    const nonces = repo();
    expect(nonces.find(nonces.create(60_000).nonce)?.origin).toBeNull();
  });
});
