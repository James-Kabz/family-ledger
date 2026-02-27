import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Contribution, Expense, ExpenseUpdate, LedgerUpdate } from "@/lib/types";
import { normalizeName, normalizeRef } from "@/lib/utils";
import {
  DuplicateRefError,
  type CreateContributionInput,
  type CreateExpenseInput,
  type CreateExpenseUpdateInput,
  type CreateLedgerUpdateInput,
  type LedgerRepository,
} from "@/lib/repo/types";

type LedgerState = {
  contributions: Contribution[];
  expenses: Expense[];
  updates: LedgerUpdate[];
  expenseUpdates: ExpenseUpdate[];
  loaded: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __familyLedgerState: LedgerState | undefined;
}

function getState(): LedgerState {
  if (!globalThis.__familyLedgerState) {
    globalThis.__familyLedgerState = { contributions: [], expenses: [], updates: [], expenseUpdates: [], loaded: false };
  }
  return globalThis.__familyLedgerState;
}

function shouldPersistDevFile() {
  return process.env.NODE_ENV !== "production";
}

function getDevFilePath() {
  const configured = process.env.LEDGER_DEV_FILE?.trim();
  return configured ? path.resolve(process.cwd(), configured) : path.join(process.cwd(), "data", "family-ledger.dev.json");
}

async function loadIfNeeded(state: LedgerState) {
  if (state.loaded || !shouldPersistDevFile()) {
    state.loaded = true;
    return;
  }

  const filePath = getDevFilePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LedgerState>;
    state.contributions = Array.isArray(parsed.contributions) ? parsed.contributions : [];
    state.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    state.updates = Array.isArray(parsed.updates) ? parsed.updates : [];
    state.expenseUpdates = Array.isArray(parsed.expenseUpdates) ? parsed.expenseUpdates : [];
  } catch {
    // Missing/invalid file falls back to empty in-memory state.
  } finally {
    state.loaded = true;
  }
}

async function persist(state: LedgerState) {
  if (!shouldPersistDevFile()) return;
  const filePath = getDevFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        contributions: state.contributions,
        expenses: state.expenses,
        updates: state.updates,
        expenseUpdates: state.expenseUpdates,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export class InMemoryRepository implements LedgerRepository {
  private state = getState();

  async listContributions(): Promise<Contribution[]> {
    await loadIfNeeded(this.state);
    return [...this.state.contributions].sort((a, b) => {
      const contributedDiff = new Date(b.contributedAt).getTime() - new Date(a.contributedAt).getTime();
      if (contributedDiff !== 0) return contributedDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async createContribution(input: CreateContributionInput): Promise<Contribution> {
    await loadIfNeeded(this.state);

    const now = new Date().toISOString();
    const normalizedRef = normalizeRef(input.ref);

    if (normalizedRef) {
      const exists = this.state.contributions.some(
        (item) => normalizeRef(item.ref)?.toLowerCase() === normalizedRef.toLowerCase(),
      );
      if (exists) {
        throw new DuplicateRefError(normalizedRef);
      }
    }

    const contribution: Contribution = {
      id: randomUUID(),
      name: normalizeName(input.name),
      amount: input.amount,
      ref: normalizedRef,
      contributedAt: input.contributedAt ? new Date(input.contributedAt).toISOString() : now,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    this.state.contributions.push(contribution);
    await persist(this.state);
    return contribution;
  }

  async deleteContribution(id: string): Promise<void> {
    await loadIfNeeded(this.state);
    this.state.contributions = this.state.contributions.filter((item) => item.id !== id);
    await persist(this.state);
  }

  async getLatestUpdate(): Promise<LedgerUpdate | null> {
    await loadIfNeeded(this.state);
    const sorted = [...this.state.updates].sort(
      (a, b) => new Date(b.cutoffAt).getTime() - new Date(a.cutoffAt).getTime(),
    );
    return sorted[0] ?? null;
  }

  async createUpdate(input: CreateLedgerUpdateInput): Promise<LedgerUpdate> {
    await loadIfNeeded(this.state);
    const item: LedgerUpdate = {
      id: randomUUID(),
      cutoffAt: new Date(input.cutoffAt).toISOString(),
      generatedMessage: input.generatedMessage,
      createdAt: new Date().toISOString(),
    };
    this.state.updates.push(item);
    await persist(this.state);
    return item;
  }

  async listExpenses(): Promise<Expense[]> {
    await loadIfNeeded(this.state);
    return [...this.state.expenses].sort((a, b) => {
      const spentDiff = new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime();
      if (spentDiff !== 0) return spentDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    await loadIfNeeded(this.state);
    const now = new Date().toISOString();

    const expense: Expense = {
      id: randomUUID(),
      title: normalizeName(input.title),
      amount: input.amount,
      spentAt: input.spentAt ? new Date(input.spentAt).toISOString() : now,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    this.state.expenses.push(expense);
    await persist(this.state);
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    await loadIfNeeded(this.state);
    this.state.expenses = this.state.expenses.filter((item) => item.id !== id);
    await persist(this.state);
  }

  async getLatestExpenseUpdate(): Promise<ExpenseUpdate | null> {
    await loadIfNeeded(this.state);
    const sorted = [...this.state.expenseUpdates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted[0] ?? null;
  }

  async createExpenseUpdate(input: CreateExpenseUpdateInput): Promise<ExpenseUpdate> {
    await loadIfNeeded(this.state);
    const item: ExpenseUpdate = {
      id: randomUUID(),
      generatedMessage: input.generatedMessage,
      createdAt: new Date().toISOString(),
    };
    this.state.expenseUpdates.push(item);
    await persist(this.state);
    return item;
  }
}
