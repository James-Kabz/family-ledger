"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createExpenseAction,
  deleteExpenseAction,
  generateExpenseUpdateAction,
  type ExpenseFormState,
  type GenerateExpenseUpdateState,
} from "@/lib/actions";
import type { Expense } from "@/lib/types";
import { formatDateTime, formatKes } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialExpenseFormState: ExpenseFormState = {};
const initialExpenseMessageState: GenerateExpenseUpdateState = { message: "" };

function formatThousands(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-KE");
}

type Props = {
  expenses: Expense[];
};

export function ExpensesPanel({ expenses }: Props) {
  const [formState, formAction] = useActionState(createExpenseAction, initialExpenseFormState);
  const [messageState, messageAction] = useActionState(generateExpenseUpdateAction, initialExpenseMessageState);
  const formRef = useRef<HTMLFormElement>(null);
  const [expenseAmount, setExpenseAmount] = useState("");

  useEffect(() => {
    if (formState.success) {
      formRef.current?.reset();
      setExpenseAmount("");
    }
  }, [formState.success]);

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses</CardTitle>
        <CardDescription>Track burial-related spending and copy an expenses-only WhatsApp update.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-title">Expense title</Label>
            <Input id="expense-title" name="title" placeholder="Tent deposit" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (KES)</Label>
            <Input
              id="expense-amount"
              name="amount"
              type="text"
              inputMode="numeric"
              placeholder="15,000"
              required
              value={expenseAmount}
              onChange={(event) => setExpenseAmount(formatThousands(event.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-spent-at">Spent at (optional)</Label>
            <Input id="expense-spent-at" name="spentAt" type="datetime-local" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expense-note">Note (optional)</Label>
            <Textarea id="expense-note" name="note" rows={2} placeholder="Paid to supplier" />
          </div>

          <div className="md:col-span-2 space-y-2">
            {formState.error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formState.error}
              </p>
            ) : null}
            {formState.success ? (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                Expense saved.
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2 flex justify-end">
            <SubmitButton pendingLabel="Saving...">Save expense</SubmitButton>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">Total expenses</span>
            <span>{formatKes(totalExpenses)}</span>
          </div>

          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map((item) => (
                <div key={item.id} className="rounded-md border bg-background px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.spentAt)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatKes(item.amount)}</p>
                  </div>
                  {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
                  <form action={deleteExpenseAction} className="mt-2 flex justify-end">
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting...">
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <form action={messageAction} className="flex justify-end">
            <SubmitButton pendingLabel="Generating...">Generate expenses message</SubmitButton>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="expenses-message">Expenses WhatsApp message</Label>
            <div className="sm:shrink-0">
              <CopyButton getText={() => messageState.message} />
            </div>
          </div>
          <Textarea
            id="expenses-message"
            value={messageState.message}
            readOnly
            rows={10}
            placeholder="Generate an expenses message to copy and share."
          />
        </div>
      </CardContent>
    </Card>
  );
}
