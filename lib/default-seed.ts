import type { LedgerRepository } from "@/lib/repo";
import { PINNED_CONTRIBUTION_ROWS } from "@/lib/pinned-contributions";
import type { Contribution } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

let seededOnce = false;

function seedKey(name: string, amount: number) {
  return `${normalizeName(name).toLowerCase()}|${amount}`;
}

function yesterdayIsoAt(hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function hasAllPinned(existing: Contribution[]) {
  const existingKeys = new Set(existing.map((row) => seedKey(row.name, row.amount)));
  return PINNED_CONTRIBUTION_ROWS.every((row) => existingKeys.has(seedKey(row.name, row.amount)));
}

export async function ensureDefaultSeedContributions(repo: LedgerRepository) {
  if (seededOnce) return;

  let existing: Contribution[];
  try {
    existing = await repo.listContributions();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Database tables are missing")) {
      return;
    }
    throw error;
  }

  if (hasAllPinned(existing)) {
    seededOnce = true;
    return;
  }

  const existingKeys = new Set(existing.map((row) => seedKey(row.name, row.amount)));
  const baseHour = 9;

  for (const [index, row] of PINNED_CONTRIBUTION_ROWS.entries()) {
    if (existingKeys.has(seedKey(row.name, row.amount))) continue;

    try {
      await repo.createContribution({
        name: row.name,
        amount: row.amount,
        contributedAt: yesterdayIsoAt(baseHour, index),
        note: "Default seeded contribution",
      });
      existingKeys.add(seedKey(row.name, row.amount));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Database tables are missing")) {
        return;
      }
      throw error;
    }
  }

  seededOnce = true;
}
