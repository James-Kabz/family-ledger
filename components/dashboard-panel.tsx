"use client";

import { useActionState, useEffect, useState } from "react";

import { generateUpdateAction, type GenerateUpdateState } from "@/lib/actions";
import type { RunningTotal } from "@/lib/types";
import { formatDateTime, formatKes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
const RUNNING_TOTALS_PAGE_SIZE = 10;

export function DashboardPanel({ totalCollected, lastUpdatedAt, newAmount, newCount, runningTotals }: Props) {
  const [state, action] = useActionState(generateUpdateAction, initialGenerateUpdateState);
  const [includeAllRunningTotals, setIncludeAllRunningTotals] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(runningTotals.length / RUNNING_TOTALS_PAGE_SIZE));
  const startIndex = (page - 1) * RUNNING_TOTALS_PAGE_SIZE;
  const visibleTotals = runningTotals.slice(startIndex, startIndex + RUNNING_TOTALS_PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
                  checked={includeAllRunningTotals}
                  onCheckedChange={setIncludeAllRunningTotals}
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
          <CardDescription>Sorted by most recent contribution time.</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="space-y-2">
              {visibleTotals.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(row.lastContributedAt)}</p>
                  </div>
                  <span className="text-muted-foreground">{formatKes(row.total)}</span>
                </li>
              ))}
            </ul>
          )}

          {runningTotals.length > RUNNING_TOTALS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
