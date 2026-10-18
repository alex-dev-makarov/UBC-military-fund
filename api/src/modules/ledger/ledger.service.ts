import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/db';
import { LedgerRepository } from './ledger.repository';
import type { ExpenseField, ExpenseFile, ExpenseFileKind, ExpenseInput, StoredExpense } from './ledger.types';

const BOT_BACKUP_LABEL = 'bot';

export type LedgerUploadedFile = { kind: ExpenseFileKind; name: string; url: string };

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly database: DatabaseService,
  ) {}

  get(id: number): StoredExpense | undefined {
    return this.ledger.get(id);
  }

  recent(limit = 10): StoredExpense[] {
    return this.ledger.recent(limit);
  }

  files(expenseId: number): ExpenseFile[] {
    return this.ledger.files(expenseId);
  }

  categories(): string[] {
    return this.ledger.categories();
  }

  people(): string[] {
    return this.ledger.people();
  }

  /** Backs up, then inserts the expense and attaches its uploaded files. */
  addExpense(data: ExpenseInput, files: LedgerUploadedFile[]): number {
    this.database.backup(BOT_BACKUP_LABEL);
    const id = this.ledger.add(data);
    for (const f of files) this.ledger.addFile(id, f.kind, f.name, f.url);
    return id;
  }

  /** Attaches files to an existing expense. Deliberately does not back up. */
  appendFiles(id: number, files: LedgerUploadedFile[]): void {
    for (const f of files) this.ledger.addFile(id, f.kind, f.name, f.url);
  }

  /** Backs up, then updates one field of an existing expense. */
  updateField<F extends ExpenseField>(id: number, field: F, value: ExpenseInput[F]): void {
    this.database.backup(BOT_BACKUP_LABEL);
    this.ledger.update(id, field, value);
  }

  /** Backs up, then removes the expense. */
  removeExpense(id: number): void {
    this.database.backup(BOT_BACKUP_LABEL);
    this.ledger.remove(id);
  }
}
