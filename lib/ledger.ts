import type { Contribution, RunningTotal } from "@/lib/types";
import { formatDateTime, formatKes, normalizeName } from "@/lib/utils";

export type DashboardMetrics = {
  totalCollected: number;
  lastUpdateAt: string | null;
  newSinceLastUpdateAmount: number;
  newSinceLastUpdateCount: number;
  newContributions: Contribution[];
  runningTotals: RunningTotal[];
};

export function computeRunningTotals(contributions: Contribution[]): RunningTotal[] {
  const totalsByKey = new Map<string, { name: string; total: number }>();

  for (const item of contributions) {
    const key = normalizeName(item.name).toLowerCase();
    const displayName = normalizeName(item.name);
    const existing = totalsByKey.get(key);
    if (existing) {
      existing.total += item.amount;
    } else {
      totalsByKey.set(key, { name: displayName, total: item.amount });
    }
  }

  return [...totalsByKey.values()].sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));
}

export function computeDashboardMetrics(contributions: Contribution[], lastCutoffAt: string | null): DashboardMetrics {
  const totalCollected = contributions.reduce((sum, item) => sum + item.amount, 0);
  const lastUpdateMs = lastCutoffAt ? new Date(lastCutoffAt).getTime() : null;
  const newContributions = contributions
    .filter((item) => (lastUpdateMs === null ? true : new Date(item.contributedAt).getTime() > lastUpdateMs))
    .sort((a, b) => new Date(a.contributedAt).getTime() - new Date(b.contributedAt).getTime());

  return {
    totalCollected,
    lastUpdateAt: lastCutoffAt,
    newSinceLastUpdateAmount: newContributions.reduce((sum, item) => sum + item.amount, 0),
    newSinceLastUpdateCount: newContributions.length,
    newContributions,
    runningTotals: computeRunningTotals(contributions),
  };
}

export function buildWhatsAppUpdateMessage(input: {
  generatedAt: string;
  metrics: DashboardMetrics;
  includeAllRunningTotals?: boolean;
}) {
  const { generatedAt, metrics } = input;
  const includeAll = Boolean(input.includeAllRunningTotals);
  const runningTotals = includeAll ? metrics.runningTotals : metrics.runningTotals.slice(0, 15);

  const lines = [
    "FAMILY CONTRIBUTIONS UPDATE",
    `Last updated: ${formatDateTime(generatedAt)}`,
    `Total collected: ${formatKes(metrics.totalCollected)}`,
    `New since last update: ${formatKes(metrics.newSinceLastUpdateAmount)} (${metrics.newSinceLastUpdateCount})`,
    "New contributions:",
  ];

  if (metrics.newContributions.length === 0) {
    lines.push("- None");
  } else {
    for (const item of metrics.newContributions) {
      const refPart = item.ref ? ` (${item.ref})` : "";
      lines.push(`- ${item.name} — ${formatKes(item.amount)}${refPart}`);
    }
  }

  lines.push("Running totals:");
  if (runningTotals.length === 0) {
    lines.push("- None");
  } else {
    for (const row of runningTotals) {
      lines.push(`- ${row.name} — ${formatKes(row.total)}`);
    }
  }

  return lines.join("\n");
}

export function findNearDuplicateWarning(
  contributions: Contribution[],
  name: string,
  amount: number,
  candidateContributedAt?: string,
) {
  const normalizedName = normalizeName(name).toLowerCase();
  const baseTime = candidateContributedAt ? new Date(candidateContributedAt).getTime() : Date.now();
  const tenMinutesMs = 10 * 60 * 1000;

  const match = contributions.find((item) => {
    if (item.ref) return false;
    if (normalizeName(item.name).toLowerCase() !== normalizedName) return false;
    if (item.amount !== amount) return false;
    const diff = Math.abs(baseTime - new Date(item.contributedAt).getTime());
    return diff <= tenMinutesMs;
  });

  if (!match) return null;
  return `Possible duplicate: same name and amount found within 10 minutes (${formatDateTime(match.contributedAt)}). Saved anyway because no ref was provided.`;
}
