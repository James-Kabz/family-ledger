import { z } from "zod";

function parseKesInt(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return Number.NaN;
    return Number(normalized);
  }
  return Number(value);
}

export const expenseInputSchema = z.object({
  title: z.string().trim().min(2, "Expense title is required").max(140, "Expense title is too long"),
  amount: z.preprocess(
    parseKesInt,
    z
      .number({ invalid_type_error: "Expense amount is required" })
      .int("Amount must be a whole number")
      .positive("Amount must be greater than 0"),
  ),
  spentAt: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid date/time"),
  note: z
    .string()
    .trim()
    .max(500, "Note is too long")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
