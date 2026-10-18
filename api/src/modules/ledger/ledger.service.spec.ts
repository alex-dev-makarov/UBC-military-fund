import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerService } from './ledger.service';
import type { ExpenseInput } from './ledger.types';

const EXPENSE: ExpenseInput = {
  date: '2026-10-12', item: 'Гума', itemEn: null, description: null, category: 'Авто', person: null,
  note: null, price: 100, delivery: 0, commission: 0, hasReceipt: true,
};
const FILES = [
  { kind: 'receipt' as const, name: 'a.jpg', url: 'https://drive/1' },
  { kind: 'photo' as const, name: 'b.jpg', url: 'https://drive/2' },
];

describe('LedgerService', () => {
  let repo: Record<
    | 'add'
    | 'addFile'
    | 'update'
    | 'remove'
    | 'get'
    | 'recent'
    | 'files'
    | 'categories'
    | 'people'
    | 'exportAll'
    | 'replaceAll'
    | 'getReport'
    | 'countUncategorized',
    ReturnType<typeof vi.fn>
  >;
  let database: { backup: ReturnType<typeof vi.fn> };
  let views: { viewsSince: ReturnType<typeof vi.fn> };
  let service: LedgerService;

  beforeEach(() => {
    repo = {
      add: vi.fn(() => 7),
      addFile: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(),
      recent: vi.fn(),
      files: vi.fn(),
      categories: vi.fn(),
      people: vi.fn(),
      exportAll: vi.fn(),
      replaceAll: vi.fn(),
      getReport: vi.fn(),
      countUncategorized: vi.fn(),
    };
    database = { backup: vi.fn() };
    views = { viewsSince: vi.fn() };
    service = new LedgerService(repo as never, database as never, views as never);
  });

  describe('reads', () => {
    it('delegate to the repository without backing up', () => {
      service.get(3);
      service.recent();
      service.files(3);
      service.categories();
      service.people();
      expect(repo.get).toHaveBeenCalledWith(3);
      expect(repo.recent).toHaveBeenCalledWith(10);
      expect(repo.files).toHaveBeenCalledWith(3);
      expect(repo.categories).toHaveBeenCalledTimes(1);
      expect(repo.people).toHaveBeenCalledTimes(1);
      expect(database.backup).not.toHaveBeenCalled();
    });
  });

  describe('ledger-wide operations (CLI)', () => {
    it('exportAll, getReport and countUncategorized delegate without backing up', () => {
      service.exportAll();
      service.getReport();
      service.countUncategorized();
      expect(repo.exportAll).toHaveBeenCalledTimes(1);
      expect(repo.getReport).toHaveBeenCalledTimes(1);
      expect(repo.countUncategorized).toHaveBeenCalledTimes(1);
      expect(database.backup).not.toHaveBeenCalled();
    });

    it('replaceAll backs up first, then delegates the source and returns the repository result', () => {
      const source = { expenses: [] };
      repo.replaceAll.mockReturnValue({ years: 0, expenses: 0 });
      expect(service.replaceAll(source)).toEqual({ years: 0, expenses: 0 });
      expect(database.backup).toHaveBeenCalledWith('import');
      expect(repo.replaceAll).toHaveBeenCalledWith(source);
      expect(database.backup.mock.invocationCallOrder[0]!).toBeLessThan(repo.replaceAll.mock.invocationCallOrder[0]!);
    });

    it('viewsSince passes the lower bound to the view log and returns its rows', () => {
      const rows = [{ telegramId: 1, viewedAt: 5, ip: null, userAgent: null }];
      views.viewsSince.mockReturnValue(rows);
      expect(service.viewsSince(1_000)).toBe(rows);
      expect(views.viewsSince).toHaveBeenCalledWith(1_000);
    });
  });

  describe('addExpense', () => {
    it('backs up, then adds the expense and attaches each file in order', () => {
      const id = service.addExpense(EXPENSE, FILES);

      expect(id).toBe(7);
      expect(database.backup).toHaveBeenCalledWith('bot');
      expect(repo.add).toHaveBeenCalledWith(EXPENSE);
      expect(repo.addFile).toHaveBeenNthCalledWith(1, 7, 'receipt', 'a.jpg', 'https://drive/1');
      expect(repo.addFile).toHaveBeenNthCalledWith(2, 7, 'photo', 'b.jpg', 'https://drive/2');

      const backup = database.backup.mock.invocationCallOrder[0]!;
      const add = repo.add.mock.invocationCallOrder[0]!;
      const firstFile = repo.addFile.mock.invocationCallOrder[0]!;
      const lastFile = repo.addFile.mock.invocationCallOrder[1]!;
      expect(backup).toBeLessThan(add);
      expect(add).toBeLessThan(firstFile);
      expect(firstFile).toBeLessThan(lastFile);
    });

    it('backs up and adds without files when none were uploaded', () => {
      service.addExpense(EXPENSE, []);
      expect(database.backup).toHaveBeenCalledTimes(1);
      expect(repo.add).toHaveBeenCalledTimes(1);
      expect(repo.addFile).not.toHaveBeenCalled();
    });
  });

  describe('appendFiles', () => {
    it('attaches files to the existing expense without backing up', () => {
      service.appendFiles(5, FILES);
      expect(repo.addFile).toHaveBeenNthCalledWith(1, 5, 'receipt', 'a.jpg', 'https://drive/1');
      expect(repo.addFile).toHaveBeenNthCalledWith(2, 5, 'photo', 'b.jpg', 'https://drive/2');
      expect(repo.add).not.toHaveBeenCalled();
      expect(database.backup).not.toHaveBeenCalled();
    });
  });

  describe('updateField', () => {
    it('backs up, then updates the field', () => {
      service.updateField(5, 'item', 'Шини');
      expect(database.backup).toHaveBeenCalledWith('bot');
      expect(repo.update).toHaveBeenCalledWith(5, 'item', 'Шини');
      expect(database.backup.mock.invocationCallOrder[0]!).toBeLessThan(repo.update.mock.invocationCallOrder[0]!);
    });
  });

  describe('removeExpense', () => {
    it('backs up, then removes the expense', () => {
      service.removeExpense(5);
      expect(database.backup).toHaveBeenCalledWith('bot');
      expect(repo.remove).toHaveBeenCalledWith(5);
      expect(database.backup.mock.invocationCallOrder[0]!).toBeLessThan(repo.remove.mock.invocationCallOrder[0]!);
    });
  });
});
