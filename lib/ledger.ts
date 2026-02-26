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
  contributions: Contribution[];
  includeAllRunningTotals?: boolean;
}) {
  const { generatedAt, metrics, contributions } = input;
  const sortedByTime = [...contributions].sort(
    (a, b) => new Date(a.contributedAt).getTime() - new Date(b.contributedAt).getTime(),
  );

  const formatPlainAmount = (amount: number) => new Intl.NumberFormat("en-KE").format(amount);
  const budgetLine = process.env.WHATSAPP_BUDGET_LINE?.trim();
  const budgetTarget = Number(process.env.TARGET_BUDGET_KES ?? "");
  const hasBudgetTarget = Number.isFinite(budgetTarget) && budgetTarget > 0;

  const lines = ["*CONTRIBUTION LIST*"];

  if (budgetLine) {
    lines.push(budgetLine);
  } else if (hasBudgetTarget) {
    lines.push(`Our total budget is *ksh.${new Intl.NumberFormat("en-KE").format(budgetTarget)}*`);
  }

  if (sortedByTime.length === 0) {
    lines.push("No contributions recorded yet.");
  } else {
    for (const [index, item] of sortedByTime.entries()) {
      lines.push(`${index + 1}.${item.name} - ${formatPlainAmount(item.amount)}✅`);
    }
  }

  lines.push("");
  lines.push(`Total collected: ${formatKes(metrics.totalCollected)}`);
  if (hasBudgetTarget) {
    const remaining = Math.max(0, budgetTarget - metrics.totalCollected);
    lines.push(`Balance to raise: ${formatKes(remaining)}`);
  }
  lines.push(`Entries: ${sortedByTime.length}`);
  lines.push(`Last updated: ${formatDateTime(generatedAt)}`);
  lines.push(`New since last update: ${formatKes(metrics.newSinceLastUpdateAmount)} (${metrics.newSinceLastUpdateCount})`);

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
