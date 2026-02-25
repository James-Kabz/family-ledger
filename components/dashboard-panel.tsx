"use client";

import { useActionState, useState } from "react";

import { generateUpdateAction, type GenerateUpdateState } from "@/lib/actions";
import type { RunningTotal } from "@/lib/types";
import { formatDateTime, formatKes } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  totalCollected: number;
  lastUpdatedAt: string | null;
  newAmount: number;
  newCount: number;
  runningTotals: RunningTotal[];
};

const initialGenerateUpdateState: GenerateUpdateState = { message: "" };

export function DashboardPanel({ totalCollected, lastUpdatedAt, newAmount, newCount, runningTotals }: Props) {
  const [state, action] = useActionState(generateUpdateAction, initialGenerateUpdateState);
  const [showAll, setShowAll] = useState(false);

  const visibleTotals = showAll ? runningTotals : runningTotals.slice(0, 15);
  const effectiveTotalCollected = state.meta?.totalCollected ?? totalCollected;
  const effectiveNewAmount = state.meta?.newAmount ?? newAmount;
  const effectiveNewCount = state.meta?.newCount ?? newCount;
  const effectiveLastUpdatedAt = state.meta?.generatedAt ?? lastUpdatedAt;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total collected</CardDescription>
              <CardTitle className="text-2xl">{formatKes(effectiveTotalCollected)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New since last update</CardDescription>
              <CardTitle className="text-2xl">{formatKes(effectiveNewAmount)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">{effectiveNewCount} contribution(s)</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last updated</CardDescription>
              <CardTitle className="text-base">
                {effectiveLastUpdatedAt ? formatDateTime(effectiveLastUpdatedAt) : "Never"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate WhatsApp update</CardTitle>
            <CardDescription>Creates and stores a new cutoff timestamp for future “new since last update” calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={action} className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Switch
                  id="include-all-running-totals"
                  name="includeAllRunningTotals"
                  checked={showAll}
                  onCheckedChange={setShowAll}
                />
                <div>
                  <Label htmlFor="include-all-running-totals">Include all running totals</Label>
                  <p className="text-xs text-muted-foreground">
                    Default message uses top 15 totals. Turn on to include everyone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <SubmitButton pendingLabel="Generating...">Generate update</SubmitButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="update-message">WhatsApp-ready message</Label>
                <div className="sm:shrink-0">
                  <CopyButton getText={() => state.message} />
                </div>
              </div>
              <Textarea
                id="update-message"
                value={state.message}
                readOnly
                rows={14}
                placeholder="Generate an update to preview the message here."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Running totals</CardTitle>
          <CardDescription>{showAll ? "Showing all contributors" : "Showing top 15 contributors"}</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="space-y-2">
              {visibleTotals.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted-foreground">{formatKes(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
