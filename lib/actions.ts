"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSession, createSession, requireAuth, verifyAdminPassword } from "@/lib/auth/session";
import { getRepository, DuplicateRefError } from "@/lib/repo";
import { loginSchema } from "@/lib/validation/auth";
import { contributionInputSchema } from "@/lib/validation/contribution";
import { expenseInputSchema } from "@/lib/validation/expense";
import {
  buildWhatsAppExpenseMessage,
  buildWhatsAppUpdateMessage,
  computeDashboardMetrics,
  findNearDuplicateWarning,
} from "@/lib/ledger";
import { toTransferRecordTitle } from "@/lib/expense-records";
import { parseMpesaReceivedMessage } from "@/lib/mpesa-sms";
import { extractTextFromPdfBuffer, parseSafaricomStatementText } from "@/lib/statement-import";

export type LoginActionState = {
  error?: string;
};

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    return { error: "Incorrect password" };
  }

  await createSession();
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export type ContributionFormState = {
  success?: boolean;
  error?: string;
  warning?: string;
};

export async function createContributionAction(
  _: ContributionFormState,
  formData: FormData,
): Promise<ContributionFormState> {
  await requireAuth();

  const optionalText = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };

  const smsText = optionalText("smsText");
  const smsParsed = smsText ? parseMpesaReceivedMessage(smsText) : {};
  const incomingName = String(formData.get("name") ?? "").trim() || smsParsed.name;
  const incomingAmount = String(formData.get("amount") ?? "").trim() || (smsParsed.amount ? String(smsParsed.amount) : "");

  const parsed = contributionInputSchema.safeParse({
    name: incomingName,
    amount: incomingAmount,
    ref: optionalText("ref") ?? smsParsed.ref,
    pledged: optionalText("pledged"),
    contributedAt: optionalText("contributedAt") ?? smsParsed.contributedAt,
    note: optionalText("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid contribution data" };
  }

  const repo = getRepository();
  const existing = await repo.listContributions();
  const warning = parsed.data.ref
    ? undefined
    : findNearDuplicateWarning(
        existing,
        parsed.data.name,
        parsed.data.amount,
        parsed.data.contributedAt,
      );

  try {
    await repo.createContribution({
      name: parsed.data.name,
      amount: parsed.data.amount,
      ref: parsed.data.ref,
      pledged: parsed.data.pledged,
      contributedAt: parsed.data.contributedAt,
      note: parsed.data.note,
    });
  } catch (error) {
    if (error instanceof DuplicateRefError) {
      return { error: "Reference already exists. This contribution was not saved." };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/contributions");

  return { success: true, warning: warning ?? undefined };
}

export async function toggleContributionPledgedAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const pledged = String(formData.get("pledged") ?? "") === "true";
  const repo = getRepository();
  await repo.updateContributionPledged(id, pledged);

  revalidatePath("/");
  revalidatePath("/contributions");
}

export async function deleteContributionAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const repo = getRepository();
  await repo.deleteContribution(id);

  revalidatePath("/");
  revalidatePath("/contributions");
}

export type ExpenseFormState = {
  success?: boolean;
  error?: string;
};

export async function createExpenseAction(
  _: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  await requireAuth();

  const optionalText = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };

  const isTransfer = String(formData.get("isTransfer") ?? "") === "on";
  const parsed = expenseInputSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    spentAt: optionalText("spentAt"),
    note: optionalText("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid expense data" };
  }

  const repo = getRepository();
  try {
    await repo.createExpense({
      title: isTransfer ? toTransferRecordTitle(parsed.data.title) : parsed.data.title,
      amount: parsed.data.amount,
      spentAt: parsed.data.spentAt,
      note: parsed.data.note,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save expense";
    return { error: message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteExpenseAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const repo = getRepository();
  await repo.deleteExpense(id);
  revalidatePath("/");
}

export type GenerateUpdateState = {
  message: string;
  error?: string;
  meta?: {
    generatedAt: string;
    totalCollected: number;
    newAmount: number;
    newCount: number;
  };
};

export async function generateUpdateAction(
  _: GenerateUpdateState,
  formData: FormData,
): Promise<GenerateUpdateState> {
  await requireAuth();

  const includeAllRunningTotals = String(formData.get("includeAllRunningTotals") ?? "") === "on";
  const repo = getRepository();
  const [contributions, latestUpdate] = await Promise.all([
    repo.listContributions(),
    repo.getLatestUpdate(),
  ]);

  const metrics = computeDashboardMetrics(contributions, latestUpdate?.cutoffAt ?? null);
  const generatedAt = new Date().toISOString();
  const message = buildWhatsAppUpdateMessage({
    generatedAt,
    metrics,
    contributions,
    includeAllRunningTotals,
  });

  await repo.createUpdate({ cutoffAt: generatedAt, generatedMessage: message });

  revalidatePath("/");

  return {
    message,
    meta: {
      generatedAt,
      totalCollected: metrics.totalCollected,
      newAmount: metrics.newSinceLastUpdateAmount,
      newCount: metrics.newSinceLastUpdateCount,
    },
  };
}

export type GenerateExpenseUpdateState = {
  message: string;
  error?: string;
};

export async function generateExpenseUpdateAction(
  _: GenerateExpenseUpdateState,
  _formData: FormData,
): Promise<GenerateExpenseUpdateState> {
  await requireAuth();
  const repo = getRepository();
  const [expenses, contributions] = await Promise.all([
    repo.listExpenses(),
    repo.listContributions(),
  ]);

  const totalCollected = contributions.reduce((sum, item) => sum + item.amount, 0);
  const message = buildWhatsAppExpenseMessage({ expenses, totalCollected });
  await repo.createExpenseUpdate({ generatedMessage: message });

  revalidatePath("/");
  return { message };
}

export type StatementImportState = {
  success?: boolean;
  error?: string;
  detectedCount?: number;
  importedCount?: number;
  skippedCount?: number;
  warnings?: string[];
  preview?: Array<{
    name: string;
    amount: number;
    contributedAt?: string;
    ref?: string;
  }>;
};

export async function importStatementPdfAction(
  _: StatementImportState,
  formData: FormData,
): Promise<StatementImportState> {
  await requireAuth();

  const file = formData.get("statementPdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF statement file." };
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = await extractTextFromPdfBuffer(buffer);
  } catch {
    return {
      error: "Failed to read the PDF. Try another statement export or share a sample text snippet for parser tuning.",
    };
  }

  const parsedRows = parseSafaricomStatementText(text);
  if (parsedRows.length === 0) {
    return {
      error:
        "No 'Funds received from' entries were detected. The statement format may differ from the current parser.",
    };
  }

  const repo = getRepository();
  let importedCount = 0;
  let skippedCount = 0;
  const warnings: string[] = [];

  for (const row of parsedRows) {
    try {
      await repo.createContribution({
        name: row.name,
        amount: row.amount,
        ref: row.ref ?? null,
        contributedAt: row.contributedAt,
        note: "Imported from Safaricom PDF statement",
      });
      importedCount += 1;
    } catch (error) {
      if (error instanceof DuplicateRefError) {
        skippedCount += 1;
        continue;
      }

      skippedCount += 1;
      warnings.push(`Skipped ${row.name} (${row.amount}) due to an unexpected error.`);
    }
  }

  revalidatePath("/");
  revalidatePath("/contributions");

  return {
    success: true,
    detectedCount: parsedRows.length,
    importedCount,
    skippedCount,
    warnings: warnings.slice(0, 5),
    preview: parsedRows.slice(0, 12).map((row) => ({
      name: row.name,
      amount: row.amount,
      contributedAt: row.contributedAt,
      ref: row.ref,
    })),
  };
}
