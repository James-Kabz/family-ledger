"use client";

import { useActionState, useEffect, useRef } from "react";

import { createContributionAction, type ContributionFormState } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";

const initialState: ContributionFormState = {};

export function ContributionForm() {
  const [state, action] = useActionState(createContributionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add contribution</CardTitle>
        <CardDescription>
          Quick manual entry. Time is recorded automatically using the current time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Jane Wanjiku" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input id="amount" name="amount" type="number" min={1} step={1} placeholder="1000" required />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={3} placeholder="Burial committee contribution" />
          </div>

          <div className="md:col-span-2 space-y-2">
            {state.error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            {state.warning ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
                {state.warning}
              </p>
            ) : null}
            {state.success && !state.error ? (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                Contribution saved.
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2 flex justify-end">
            <SubmitButton pendingLabel="Saving...">Save contribution</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
