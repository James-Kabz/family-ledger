import type { Contribution, Expense, RunningTotal } from "@/lib/types";
import { isTransferRecordTitle } from "@/lib/expense-records";
import { PINNED_CONTRIBUTION_ROWS } from "@/lib/pinned-contributions";
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
  const totalsByKey = new Map<string, { key: string; name: string; total: number; lastContributedAtMs: number }>();

  for (const item of contributions) {
    const contributedAtMs = new Date(item.contributedAt).getTime();
    const key = normalizeName(item.name).toLowerCase();
    const displayName = normalizeName(item.name);
    const existing = totalsByKey.get(key);
    if (existing) {
      existing.total += item.amount;
      if (contributedAtMs > existing.lastContributedAtMs) {
        existing.lastContributedAtMs = contributedAtMs;
      }
    } else {
      totalsByKey.set(key, {
        key,
        name: displayName,
        total: item.amount,
        lastContributedAtMs: contributedAtMs,
      });
    }
  }

  return [...totalsByKey.values()]
    .sort((a, b) => (b.lastContributedAtMs - a.lastContributedAtMs) || a.name.localeCompare(b.name))
    .map((row) => ({
      key: row.key,
      name: row.name,
      total: row.total,
      lastContributedAt: new Date(row.lastContributedAtMs).toISOString(),
    }));
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
  const fixedRows = PINNED_CONTRIBUTION_ROWS;
  const normalizePinnedKey = (name: string, amount: number) =>
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${amount}`;
  const fixedKeys = new Set(fixedRows.map((row) => normalizePinnedKey(row.name, row.amount)));
  const sortedByTime = [...contributions].sort(
    (a, b) => new Date(a.contributedAt).getTime() - new Date(b.contributedAt).getTime(),
  );
  const dynamicCandidates = sortedByTime.filter(
    (row) => !fixedKeys.has(normalizePinnedKey(row.name, row.amount)),
  );
  const configuredMax = Number(process.env.WHATSAPP_EXPORT_MAX_ITEMS ?? "");
  const hasConfiguredMax = Number.isFinite(configuredMax) && configuredMax > 0;
  const dynamicSlots = hasConfiguredMax ? Math.max(0, Math.floor(configuredMax) - fixedRows.length) : dynamicCandidates.length;
  const visibleDynamic = dynamicSlots > 0 ? dynamicCandidates.slice(-dynamicSlots) : [];

  const formatPlainAmount = (amount: number) => new Intl.NumberFormat("en-KE").format(amount);
  const budgetLine =
    process.env.WHATSAPP_BUDGET_LINE?.trim() ??
    "Our total budget *ksh.1.7M* (inclusive of hospital bill and burial preparations budget)";
  const officialRecipientName = process.env.WHATSAPP_OFFICIAL_RECIPIENT_NAME?.trim() || "James Njoroge";
  const officialRecipientPhone = process.env.WHATSAPP_OFFICIAL_RECIPIENT_PHONE?.trim() || "0740289578";
  const budgetTarget = Number(process.env.TARGET_BUDGET_KES ?? "");
  const hasBudgetTarget = Number.isFinite(budgetTarget) && budgetTarget > 0;

  const lines = ["*CONTRIBUTION LIST*", ""];

  if (budgetLine) {
    lines.push(budgetLine);
  } else if (hasBudgetTarget) {
    lines.push(`Our total budget *ksh.${new Intl.NumberFormat("en-KE").format(budgetTarget)}*`);
  }
  lines.push("");
  lines.push("Official recipient:");
  lines.push(`*${officialRecipientName}* - *${officialRecipientPhone}*`);
  lines.push("");

  let visibleList = [
    ...fixedRows.map((row) => ({ name: row.name, amount: row.amount })),
    ...visibleDynamic.map((row) => ({ name: row.name, amount: row.amount })),
  ];

  if (hasConfiguredMax) {
    visibleList = visibleList.slice(0, Math.floor(configuredMax));
  }

  if (visibleList.length === 0) {
    lines.push("No contributions recorded yet.");
  } else {
    for (const [index, item] of visibleList.entries()) {
      lines.push(`${index + 1}. ${item.name} - ${formatPlainAmount(item.amount)} ✅`);
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

export function buildWhatsAppExpenseMessage(input: {
  expenses: Expense[];
  totalCollected: number;
}) {
  const { expenses, totalCollected } = input;
  const sortedByTime = [...expenses]
    .filter((item) => !isTransferRecordTitle(item.title))
    .sort(
      (a, b) => new Date(a.spentAt).getTime() - new Date(b.spentAt).getTime(),
    );
  const lines = ["*EXPENSES LIST*", ""];

  if (sortedByTime.length === 0) {
    lines.push("No expenses recorded yet.");
  } else {
    for (const [index, item] of sortedByTime.entries()) {
      const amount = new Intl.NumberFormat("en-KE").format(item.amount);
      lines.push(`${index + 1}. ${item.title} - ${amount} ✅`);
    }
  }

  const totalExpenses = sortedByTime.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalCollected - totalExpenses;

  lines.push("");
  lines.push(`Total expenses: ${formatKes(totalExpenses)}`);
  lines.push(`Remaining balance: ${formatKes(balance)}`);

  return lines.join("\n");
}
