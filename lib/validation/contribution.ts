import { z } from "zod";

export const contributionInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120, "Name is too long"),
  amount: z.coerce
    .number({ invalid_type_error: "Amount is required" })
    .int("Amount must be a whole number")
    .positive("Amount must be greater than 0"),
  ref: z
    .string()
    .trim()
    .max(120, "Reference is too long")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  contributedAt: z
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

export type ContributionInput = z.infer<typeof contributionInputSchema>;
