import { Injectable } from '@nestjs/common';
import { FundRepository } from './fund.repository';
import type { PublicFund } from './fund.types';

@Injectable()
export class FundService {
  constructor(private readonly fund: FundRepository) {}

  /** Seeds the fund reference data once. Returns false when it was already seeded. */
  seedIfEmpty(): boolean {
    return this.fund.seedIfEmpty();
  }

  getPublicFund(): PublicFund {
    return this.fund.getPublicFund();
  }
}
