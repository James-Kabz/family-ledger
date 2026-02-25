import type { Contribution, LedgerUpdate } from "@/lib/types";

export type CreateContributionInput = {
  name: string;
  amount: number;
  ref?: string | null;
  contributedAt?: string;
  note?: string | null;
};

export type CreateLedgerUpdateInput = {
  cutoffAt: string;
  generatedMessage: string;
};

export interface LedgerRepository {
  listContributions(): Promise<Contribution[]>;
  createContribution(input: CreateContributionInput): Promise<Contribution>;
  deleteContribution(id: string): Promise<void>;
  getLatestUpdate(): Promise<LedgerUpdate | null>;
  createUpdate(input: CreateLedgerUpdateInput): Promise<LedgerUpdate>;
}

export class DuplicateRefError extends Error {
  constructor(ref: string) {
    super(`Contribution with ref '${ref}' already exists`);
    this.name = "DuplicateRefError";
  }
}
