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
      });
      continue;
    }

    existing.total += item.amount;
    existing.count += 1;
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
  const rows = summarize(contributions).filter((row) => (q ? row.name.toLowerCase().includes(q) : true));

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
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{row.name}</p>
                    <p className="text-sm font-semibold">{formatKes(row.total)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.count} contribution(s) • Last: {formatDateTime(row.lastContributedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
