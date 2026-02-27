import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizeName, normalizeRef } from "@/lib/utils";
import type { Contribution, Expense, ExpenseUpdate, LedgerUpdate } from "@/lib/types";
import {
  DuplicateRefError,
  type CreateContributionInput,
  type CreateExpenseInput,
  type CreateExpenseUpdateInput,
  type CreateLedgerUpdateInput,
  type LedgerRepository,
} from "@/lib/repo/types";

type PrismaClientLike = {
  contribution: {
    findMany(args?: unknown): Promise<any[]>;
    findFirst(args?: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
  };
  expense: {
    findMany(args?: unknown): Promise<any[]>;
    create(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
  };
  ledgerUpdate: {
    findFirst(args?: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
  };
  expenseUpdate: {
    findFirst(args?: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
  };
};

function hasExpenseModels(prisma: PrismaClientLike) {
  return Boolean(prisma.expense && prisma.expenseUpdate);
}

function prismaClientOutOfDateMessage() {
  return "Prisma client is out of date for expenses. Run `npx prisma generate` and restart the app.";
}

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

function missingSchemaMessage() {
  return "Database tables are missing. Run Prisma migrations for this database (e.g. `npx prisma migrate dev` locally or `prisma migrate deploy` in production).";
}

declare global {
  // eslint-disable-next-line no-var
  var __familyLedgerPrisma: PrismaClientLike | undefined;
}

async function getPrisma(): Promise<PrismaClientLike> {
  if (globalThis.__familyLedgerPrisma && hasExpenseModels(globalThis.__familyLedgerPrisma)) {
    return globalThis.__familyLedgerPrisma;
  }

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required when USE_DB=true");
    }

    const adapter = new PrismaPg({ connectionString });
    const client = new PrismaClient({ adapter }) as unknown as PrismaClientLike;
    globalThis.__familyLedgerPrisma = client;
    return client;
  } catch (error) {
    throw new Error(
      "USE_DB=true but Prisma runtime is not ready. Install prisma + @prisma/client + @prisma/adapter-pg + pg, set DATABASE_URL, run migrations, and generate the client.",
      { cause: error },
    );
  }
}

function mapContribution(row: any): Contribution {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    ref: row.ref ?? null,
    contributedAt: new Date(row.contributedAt).toISOString(),
    note: row.note ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mapUpdate(row: any): LedgerUpdate {
  return {
    id: row.id,
    cutoffAt: new Date(row.cutoffAt).toISOString(),
    generatedMessage: row.generatedMessage,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    spentAt: new Date(row.spentAt).toISOString(),
    note: row.note ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mapExpenseUpdate(row: any): ExpenseUpdate {
  return {
    id: row.id,
    generatedMessage: row.generatedMessage,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export class PrismaRepository implements LedgerRepository {
  async listContributions(): Promise<Contribution[]> {
    const prisma = await getPrisma();
    try {
      const rows = await prisma.contribution.findMany({
        orderBy: [{ contributedAt: "desc" }, { createdAt: "desc" }],
      });
      return rows.map(mapContribution);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async createContribution(input: CreateContributionInput): Promise<Contribution> {
    const prisma = await getPrisma();
    const ref = normalizeRef(input.ref);

    if (ref) {
      const existing = await prisma.contribution.findFirst({
        where: { ref: { equals: ref, mode: "insensitive" } },
      });
      if (existing) throw new DuplicateRefError(ref);
    }

    let row: any;
    try {
      row = await prisma.contribution.create({
        data: {
          name: normalizeName(input.name),
          amount: input.amount,
          ref,
          contributedAt: input.contributedAt ? new Date(input.contributedAt) : new Date(),
          note: input.note?.trim() || null,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }

    return mapContribution(row);
  }

  async deleteContribution(id: string): Promise<void> {
    const prisma = await getPrisma();
    try {
      await prisma.contribution.delete({ where: { id } });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }
  }

  async getLatestUpdate(): Promise<LedgerUpdate | null> {
    const prisma = await getPrisma();
    let row: any | null;
    try {
      row = await prisma.ledgerUpdate.findFirst({ orderBy: { cutoffAt: "desc" } });
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
    return row ? mapUpdate(row) : null;
  }

  async createUpdate(input: CreateLedgerUpdateInput): Promise<LedgerUpdate> {
    const prisma = await getPrisma();
    let row: any;
    try {
      row = await prisma.ledgerUpdate.create({
        data: {
          cutoffAt: new Date(input.cutoffAt),
          generatedMessage: input.generatedMessage,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }
    return mapUpdate(row);
  }

  async listExpenses(): Promise<Expense[]> {
    const prisma = await getPrisma();
    if (!hasExpenseModels(prisma)) return [];
    try {
      const rows = await prisma.expense.findMany({
        orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
      });
      return rows.map(mapExpense);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const prisma = await getPrisma();
    if (!hasExpenseModels(prisma)) {
      throw new Error(prismaClientOutOfDateMessage());
    }
    let row: any;
    try {
      row = await prisma.expense.create({
        data: {
          title: normalizeName(input.title),
          amount: input.amount,
          spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
          note: input.note?.trim() || null,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }

    return mapExpense(row);
  }

  async deleteExpense(id: string): Promise<void> {
    const prisma = await getPrisma();
    if (!hasExpenseModels(prisma)) {
      throw new Error(prismaClientOutOfDateMessage());
    }
    try {
      await prisma.expense.delete({ where: { id } });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }
  }

  async getLatestExpenseUpdate(): Promise<ExpenseUpdate | null> {
    const prisma = await getPrisma();
    if (!hasExpenseModels(prisma)) return null;
    let row: any | null;
    try {
      row = await prisma.expenseUpdate.findFirst({ orderBy: { createdAt: "desc" } });
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
    return row ? mapExpenseUpdate(row) : null;
  }

  async createExpenseUpdate(input: CreateExpenseUpdateInput): Promise<ExpenseUpdate> {
    const prisma = await getPrisma();
    if (!hasExpenseModels(prisma)) {
      throw new Error(prismaClientOutOfDateMessage());
    }
    let row: any;
    try {
      row = await prisma.expenseUpdate.create({
        data: {
          generatedMessage: input.generatedMessage,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(missingSchemaMessage());
      }
      throw error;
    }
    return mapExpenseUpdate(row);
  }
}
