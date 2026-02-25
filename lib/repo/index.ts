import { InMemoryRepository } from "@/lib/repo/in-memory";
import { PrismaRepository } from "@/lib/repo/prisma";
import type { LedgerRepository } from "@/lib/repo/types";

function useDb() {
  return process.env.USE_DB?.toLowerCase() === "true";
}

let inMemoryRepo: InMemoryRepository | null = null;
let prismaRepo: PrismaRepository | null = null;

export function getRepository(): LedgerRepository {
  if (useDb()) {
    prismaRepo ??= new PrismaRepository();
    return prismaRepo;
  }

  inMemoryRepo ??= new InMemoryRepository();
  return inMemoryRepo;
}

export * from "@/lib/repo/types";
