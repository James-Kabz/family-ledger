import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizeName, normalizeRef } from "@/lib/utils";
import type { Contribution, LedgerUpdate } from "@/lib/types";
import { DuplicateRefError, type CreateContributionInput, type CreateLedgerUpdateInput, type LedgerRepository } from "@/lib/repo/types";

type PrismaClientLike = {
  contribution: {
    findMany(args?: unknown): Promise<any[]>;
    findFirst(args?: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
  };
  ledgerUpdate: {
    findFirst(args?: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __familyLedgerPrisma: PrismaClientLike | undefined;
}

async function getPrisma(): Promise<PrismaClientLike> {
  if (globalThis.__familyLedgerPrisma) return globalThis.__familyLedgerPrisma;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required when USE_DB=true");
    }

    const adapter = new PrismaPg({ connectionString });
    const client = new PrismaClient({ adapter }) as PrismaClientLike;
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

export class PrismaRepository implements LedgerRepository {
  async listContributions(): Promise<Contribution[]> {
    const prisma = await getPrisma();
    const rows = await prisma.contribution.findMany({
      orderBy: [{ contributedAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(mapContribution);
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

    const row = await prisma.contribution.create({
      data: {
        name: normalizeName(input.name),
        amount: input.amount,
        ref,
        contributedAt: input.contributedAt ? new Date(input.contributedAt) : new Date(),
        note: input.note?.trim() || null,
      },
    });

    return mapContribution(row);
  }

  async deleteContribution(id: string): Promise<void> {
    const prisma = await getPrisma();
    await prisma.contribution.delete({ where: { id } });
  }

  async getLatestUpdate(): Promise<LedgerUpdate | null> {
    const prisma = await getPrisma();
    const row = await prisma.ledgerUpdate.findFirst({ orderBy: { cutoffAt: "desc" } });
    return row ? mapUpdate(row) : null;
  }

  async createUpdate(input: CreateLedgerUpdateInput): Promise<LedgerUpdate> {
    const prisma = await getPrisma();
    const row = await prisma.ledgerUpdate.create({
      data: {
        cutoffAt: new Date(input.cutoffAt),
        generatedMessage: input.generatedMessage,
      },
    });
    return mapUpdate(row);
  }
}
