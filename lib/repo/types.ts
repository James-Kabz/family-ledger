import type { Contribution, Expense, ExpenseUpdate, LedgerUpdate } from "@/lib/types";

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

export type CreateExpenseInput = {
  title: string;
  amount: number;
  spentAt?: string;
  note?: string | null;
};

export type CreateExpenseUpdateInput = {
  generatedMessage: string;
};

export interface LedgerRepository {
  listContributions(): Promise<Contribution[]>;
  createContribution(input: CreateContributionInput): Promise<Contribution>;
  deleteContribution(id: string): Promise<void>;
  getLatestUpdate(): Promise<LedgerUpdate | null>;
  createUpdate(input: CreateLedgerUpdateInput): Promise<LedgerUpdate>;
  listExpenses(): Promise<Expense[]>;
  createExpense(input: CreateExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  getLatestExpenseUpdate(): Promise<ExpenseUpdate | null>;
  createExpenseUpdate(input: CreateExpenseUpdateInput): Promise<ExpenseUpdate>;
}

export class DuplicateRefError extends Error {
  constructor(ref: string) {
    super(`Contribution with ref '${ref}' already exists`);
    this.name = "DuplicateRefError";
  }
}
