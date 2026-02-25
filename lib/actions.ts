"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSession, createSession, requireAuth, verifyAdminPassword } from "@/lib/auth/session";
import { getRepository, DuplicateRefError } from "@/lib/repo";
import { loginSchema } from "@/lib/validation/auth";
import { contributionInputSchema } from "@/lib/validation/contribution";
import { buildWhatsAppUpdateMessage, computeDashboardMetrics, findNearDuplicateWarning } from "@/lib/ledger";

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

  const parsed = contributionInputSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    ref: optionalText("ref"),
    contributedAt: optionalText("contributedAt"),
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

  return { success: true, warning };
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
  prev: GenerateUpdateState,
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
  const message = buildWhatsAppUpdateMessage({ generatedAt, metrics, includeAllRunningTotals });

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
