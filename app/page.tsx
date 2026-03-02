import Link from "next/link";

import { ContributionForm } from "@/components/contribution-form";
import { ContributorSearchModal } from "@/components/contributor-search-modal";
import { DashboardPanel } from "@/components/dashboard-panel";
import { ExpensesPanel } from "@/components/expenses-panel";
import { LogoutButton } from "@/components/logout-button";
import { MobileActionModal } from "@/components/mobile-action-modal";
import { StatementImportForm } from "@/components/statement-import-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteContributionAction, toggleContributionPledgedAction } from "@/lib/actions";
import { requireAuth } from "@/lib/auth/session";
import { ensureDefaultSeedContributions } from "@/lib/default-seed";
import { computeDashboardMetrics } from "@/lib/ledger";
import { getRepository } from "@/lib/repo";
import type { Contribution } from "@/lib/types";
import { cn, formatDateTime, formatKes } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    day?: string | string[];
  }>;
};

type FilterPanelBodyProps = {
  selectedDayMode: "day" | "all";
  selectedDayKey: string;
  todayKey: string;
  yesterdayKey: string;
  todayHref: string;
  yesterdayHref: string;
  allHref: string;
  visibleCount: number;
  visibleTotal: number;
};

function toDayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isValidDayKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getDayKeyForContribution(item: Contribution) {
  return toDayKey(new Date(item.contributedAt));
}

function buildDashboardHref(input: { dayMode: "day" | "all"; dayKey: string }) {
  const params = new URLSearchParams();
  if (input.dayMode === "all") {
    params.set("day", "all");
  } else if (input.dayKey) {
    params.set("day", input.dayKey);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function LedgerFilterPanelBody({
  selectedDayMode,
  selectedDayKey,
  todayKey,
  yesterdayKey,
  todayHref,
  yesterdayHref,
  allHref,
  visibleCount,
  visibleTotal,
}: FilterPanelBodyProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={todayHref}
          className={cn(
            buttonVariants({
              variant: selectedDayMode === "day" && selectedDayKey === todayKey ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          Today
        </Link>
        <Link
          href={yesterdayHref}
          className={cn(
            buttonVariants({
              variant: selectedDayMode === "day" && selectedDayKey === yesterdayKey ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          Yesterday
        </Link>
        <Link
          href={allHref}
          className={cn(
            buttonVariants({
              variant: selectedDayMode === "all" ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          All
        </Link>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get" action="/">
        <div className="w-full space-y-2 sm:max-w-xs">
          <label htmlFor="day" className="text-sm font-medium">
            Pick date
          </label>
          <Input id="day" name="day" type="date" defaultValue={selectedDayMode === "day" ? selectedDayKey : todayKey} />
        </div>
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingLabel="Applying..." className="flex-1 sm:flex-none">
            Apply
          </SubmitButton>
          <Link href={allHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex-1 sm:flex-none")}>
            Clear
          </Link>
        </div>
      </form>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium text-foreground">
          {selectedDayMode === "all" ? "Showing all entries" : `Showing ${formatDayLabel(selectedDayKey)}`}
        </p>
        <p className="text-muted-foreground">
          {visibleCount} item(s), {formatKes(visibleTotal)} total in this view.
        </p>
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  await requireAuth();

  const params = (await searchParams) ?? {};
  const dayParam = Array.isArray(params.day) ? params.day[0] : params.day;

  const repo = getRepository();
  await ensureDefaultSeedContributions(repo);
  const [contributions, latestUpdate, expenses] = await Promise.all([
    repo.listContributions(),
    repo.getLatestUpdate(),
    repo.listExpenses(),
  ]);

  const metrics = computeDashboardMetrics(contributions, latestUpdate?.cutoffAt ?? null);

  const todayKey = toDayKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  const selectedDayMode = dayParam === "all" ? "all" : "day";
  const selectedDayKey = selectedDayMode === "day" && isValidDayKey(dayParam) ? dayParam : todayKey;

  const dayFilteredContributions =
    selectedDayMode === "all"
      ? contributions
      : contributions.filter((item) => getDayKeyForContribution(item) === selectedDayKey);
  const visibleContributions = dayFilteredContributions;

  const visibleTotal = visibleContributions.reduce((sum, item) => sum + item.amount, 0);
  const todayHref = buildDashboardHref({ dayMode: "day", dayKey: todayKey });
  const yesterdayHref = buildDashboardHref({ dayMode: "day", dayKey: yesterdayKey });
  const allHref = buildDashboardHref({ dayMode: "all", dayKey: selectedDayKey });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Family ledger</h1>
          <p className="text-sm text-muted-foreground">
            One-page workflow for quick entry, day filtering, and WhatsApp updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ContributorSearchModal contributions={contributions} />
          <LogoutButton />
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current ledger snapshot</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {contributions.length} record(s) total. Use quick actions on mobile or the side panels on larger screens.
        </CardContent>
      </Card>

      <Card className="lg:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick actions</CardTitle>
          <CardDescription>Open entry and filter tools in mobile-friendly modals.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MobileActionModal
            triggerLabel="Add contribution"
            title="Add contribution"
            description="Quick entry form for a new family contribution."
            triggerVariant="default"
            contentClassName="border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
          >
            <ContributionForm />
          </MobileActionModal>

          <MobileActionModal
            triggerLabel="Filter ledger"
            title="Filter ledger"
            description="Choose today, yesterday, a date, or all entries."
            triggerVariant="outline"
            contentClassName="border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
          >
            <Card>
              <CardHeader>
                <CardTitle>Ledger filter</CardTitle>
                <CardDescription>Switch between today, yesterday, a selected date, or all entries.</CardDescription>
              </CardHeader>
              <CardContent>
                <LedgerFilterPanelBody
                  selectedDayMode={selectedDayMode}
                  selectedDayKey={selectedDayKey}
                  todayKey={todayKey}
                  yesterdayKey={yesterdayKey}
                  todayHref={todayHref}
                  yesterdayHref={yesterdayHref}
                  allHref={allHref}
                  visibleCount={visibleContributions.length}
                  visibleTotal={visibleTotal}
                />
              </CardContent>
            </Card>
          </MobileActionModal>

          <MobileActionModal
            triggerLabel="Import PDF statement"
            title="Import Safaricom statement PDF"
            description="Import only transactions with 'Funds received from' in the details column."
            triggerVariant="outline"
            contentClassName="border-0 bg-transparent p-0 shadow-none sm:max-w-xl"
          >
            <StatementImportForm />
          </MobileActionModal>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.55fr]">
        <div className="hidden space-y-6 lg:block">
          <ContributionForm />
          <StatementImportForm />
          <Card>
            <CardHeader>
              <CardTitle>Ledger filter</CardTitle>
              <CardDescription>Switch between today, yesterday, a selected date, or all entries.</CardDescription>
            </CardHeader>
            <CardContent>
              <LedgerFilterPanelBody
                selectedDayMode={selectedDayMode}
                selectedDayKey={selectedDayKey}
                todayKey={todayKey}
                yesterdayKey={yesterdayKey}
                todayHref={todayHref}
                yesterdayHref={yesterdayHref}
                allHref={allHref}
                visibleCount={visibleContributions.length}
                visibleTotal={visibleTotal}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <DashboardPanel
            totalCollected={metrics.totalCollected}
            lastUpdatedAt={latestUpdate?.cutoffAt ?? null}
            newAmount={metrics.newSinceLastUpdateAmount}
            newCount={metrics.newSinceLastUpdateCount}
            runningTotals={metrics.runningTotals}
          />

          <ExpensesPanel expenses={expenses} />

          <Card>
            <CardHeader>
              <CardTitle>Ledger list</CardTitle>
              <CardDescription>
                {selectedDayMode === "all"
                  ? "Showing all records (newest first)."
                  : `Entries recorded on ${formatDayLabel(selectedDayKey)}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleContributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contributions found for this view.</p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {visibleContributions.map((item) => (
                      <div key={item.id} className="rounded-xl border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">{item.name}</p>
                              {item.pledged ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Pledged
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(item.contributedAt)}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-foreground">{formatKes(item.amount)}</p>
                        </div>

                        {item.note ? (
                          <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">{item.note}</p>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Time</span>
                          <span>{formatTimeOnly(item.contributedAt)}</span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <form action={toggleContributionPledgedAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="pledged" value={item.pledged ? "false" : "true"} />
                            <SubmitButton variant="outline" size="sm" pendingLabel="Updating..." className="w-full">
                              {item.pledged ? "Mark received" : "Mark pledged"}
                            </SubmitButton>
                          </form>
                          <form action={deleteContributionAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting..." className="w-full">
                              Delete entry
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Full timestamp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="w-[240px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleContributions.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{formatKes(item.amount)}</TableCell>
                            <TableCell>{formatTimeOnly(item.contributedAt)}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDateTime(item.contributedAt)}</TableCell>
                            <TableCell>
                              {item.pledged ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Pledged
                                </span>
                              ) : (
                                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                  Received
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate">
                              {item.note ?? <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <form action={toggleContributionPledgedAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <input type="hidden" name="pledged" value={item.pledged ? "false" : "true"} />
                                  <SubmitButton variant="outline" size="sm" pendingLabel="Updating...">
                                    {item.pledged ? "Mark received" : "Mark pledged"}
                                  </SubmitButton>
                                </form>
                                <form action={deleteContributionAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting...">
                                    Delete
                                  </SubmitButton>
                                </form>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
