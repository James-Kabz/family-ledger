"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Contribution } from "@/lib/types";
import { formatDateTime, formatKes, normalizeName } from "@/lib/utils";

type ContributorSummary = {
  key: string;
  name: string;
  total: number;
  count: number;
  lastContributedAt: string;
  contributions: Array<{
    id: string;
    amount: number;
    contributedAt: string;
    pledged: boolean;
  }>;
};

type Props = {
  contributions: Contribution[];
};

function summarize(contributions: Contribution[]): ContributorSummary[] {
  const map = new Map<string, ContributorSummary>();

  for (const item of contributions) {
    const normalized = normalizeName(item.name);
    const key = normalized.toLowerCase();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        name: normalized,
        total: item.amount,
        count: 1,
        lastContributedAt: item.contributedAt,
        contributions: [
          {
            id: item.id,
            amount: item.amount,
            contributedAt: item.contributedAt,
            pledged: item.pledged,
          },
        ],
      });
      continue;
    }

    existing.total += item.amount;
    existing.count += 1;
    existing.contributions.push({
      id: item.id,
      amount: item.amount,
      contributedAt: item.contributedAt,
      pledged: item.pledged,
    });
    if (new Date(item.contributedAt).getTime() > new Date(existing.lastContributedAt).getTime()) {
      existing.lastContributedAt = item.contributedAt;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });
}

export function ContributorSearchModal({ contributions }: Props) {
  const [query, setQuery] = useState("");
  const q = normalizeName(query).toLowerCase();
  const rows = summarize(contributions)
    .filter((row) => (q ? row.name.toLowerCase().includes(q) : true))
    .map((row) => ({
      ...row,
      contributions: [...row.contributions].sort(
        (a, b) => new Date(b.contributedAt).getTime() - new Date(a.contributedAt).getTime(),
      ),
    }));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Search contributors
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Search contributors</DialogTitle>
          <DialogDescription>Find anyone who has contributed and view their totals.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a contributor name..."
            autoFocus
          />

          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">No matching contributors.</p>
            ) : (
              rows.map((row) => (
                <div key={row.key} className="rounded-md border bg-background px-3 py-2">
                  {row.count > 1 ? (
                    <details>
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{row.name}</p>
                          <p className="text-sm font-semibold">{formatKes(row.total)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.count} contribution(s) • Last: {formatDateTime(row.lastContributedAt)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Expand to see contribution breakdown</p>
                      </summary>
                      <div className="mt-2 space-y-2 border-t pt-2">
                        {row.contributions.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                            <div className="text-muted-foreground">
                              {formatDateTime(item.contributedAt)}
                              {item.pledged ? " • Pledged" : ""}
                            </div>
                            <div className="font-medium">{formatKes(item.amount)}</div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t pt-2 text-xs font-semibold">
                          <span>Total</span>
                          <span>{formatKes(row.total)}</span>
                        </div>
                      </div>
                    </details>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{row.name}</p>
                        <p className="text-sm font-semibold">{formatKes(row.total)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.count} contribution(s) • Last: {formatDateTime(row.lastContributedAt)}
                      </p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
