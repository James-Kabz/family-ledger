import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Contribution, LedgerUpdate } from "@/lib/types";
import { normalizeName, normalizeRef } from "@/lib/utils";
import { DuplicateRefError, type CreateContributionInput, type CreateLedgerUpdateInput, type LedgerRepository } from "@/lib/repo/types";

type LedgerState = {
  contributions: Contribution[];
  updates: LedgerUpdate[];
  loaded: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __familyLedgerState: LedgerState | undefined;
}

function getState(): LedgerState {
  if (!globalThis.__familyLedgerState) {
    globalThis.__familyLedgerState = { contributions: [], updates: [], loaded: false };
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
    state.updates = Array.isArray(parsed.updates) ? parsed.updates : [];
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
    JSON.stringify({ contributions: state.contributions, updates: state.updates }, null, 2),
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
}
