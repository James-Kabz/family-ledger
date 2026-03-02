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
import { cn, formatDateTime, formatKes, formatTimeInKenya } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    day?: string | string[];
    page?: string | string[];
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

type LedgerPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  getHref(page: number): string;
};

const LEDGER_PAGE_SIZE = 12;

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

function isValidDayKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getDayKeyForContribution(item: Contribution) {
  return toDayKey(new Date(item.contributedAt));
}

function parsePositiveInt(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function buildDashboardHref(input: { dayMode: "day" | "all"; dayKey: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.dayMode === "all") {
    params.set("day", "all");
  } else if (input.dayKey) {
    params.set("day", input.dayKey);
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function getLedgerPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) items.push("ellipsis");
  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }
  if (windowEnd < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);

  return items;
}

function LedgerPagination({ currentPage, totalPages, totalItems, pageSize, getHref }: LedgerPaginationProps) {
  if (totalPages <= 1) return null;

  const pageStart = (currentPage - 1) * pageSize;
  const start = pageStart + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageItems = getLedgerPageItems(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {start}-{end} of {totalItems}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={getHref(currentPage - 1)}
          scroll={false}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            currentPage === 1 ? "pointer-events-none opacity-50" : "",
          )}
          aria-disabled={currentPage === 1}
          tabIndex={currentPage === 1 ? -1 : undefined}
        >
          Prev
        </Link>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <Link
              key={`page-${item}`}
              href={getHref(item)}
              scroll={false}
              className={cn(buttonVariants({ variant: item === currentPage ? "default" : "outline", size: "sm" }))}
            >
              {item}
            </Link>
          ),
        )}
        <Link
          href={getHref(currentPage + 1)}
          scroll={false}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            currentPage === totalPages ? "pointer-events-none opacity-50" : "",
          )}
          aria-disabled={currentPage === totalPages}
          tabIndex={currentPage === totalPages ? -1 : undefined}
        >
          Next
        </Link>
      </div>
    </div>
  );
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
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;

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
  const totalPages = Math.max(1, Math.ceil(visibleContributions.length / LEDGER_PAGE_SIZE));
  const requestedPage = parsePositiveInt(pageParam) ?? 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pageOffset = (currentPage - 1) * LEDGER_PAGE_SIZE;
  const paginatedVisibleContributions = visibleContributions.slice(pageOffset, pageOffset + LEDGER_PAGE_SIZE);

  const visibleTotal = visibleContributions.reduce((sum, item) => sum + item.amount, 0);
  const todayHref = buildDashboardHref({ dayMode: "day", dayKey: todayKey, page: 1 });
  const yesterdayHref = buildDashboardHref({ dayMode: "day", dayKey: yesterdayKey, page: 1 });
  const allHref = buildDashboardHref({ dayMode: "all", dayKey: selectedDayKey, page: 1 });
  const getLedgerPageHref = (page: number) => {
    const normalized = Math.min(Math.max(page, 1), totalPages);
    return buildDashboardHref({ dayMode: selectedDayMode, dayKey: selectedDayKey, page: normalized });
  };

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
          <a href="/api/export/transactions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Export Excel
          </a>
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
            pledgedAmount={metrics.pledgedAmount}
            pledgedCount={metrics.pledgedCount}
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
            <CardContent className="space-y-4">
              {visibleContributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contributions found for this view.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Records in this view</p>
                      <p className="text-sm font-semibold">{visibleContributions.length}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Total amount in this view</p>
                      <p className="text-sm font-semibold">{formatKes(visibleTotal)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Current page</p>
                      <p className="text-sm font-semibold">
                        {currentPage} / {totalPages}
                      </p>
                    </div>
                  </div>

                  <LedgerPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={visibleContributions.length}
                    pageSize={LEDGER_PAGE_SIZE}
                    getHref={getLedgerPageHref}
                  />

                  <div className="space-y-3 md:hidden">
                    {paginatedVisibleContributions.map((item) => (
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
                          <span>{formatTimeInKenya(item.contributedAt)}</span>
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
                        {paginatedVisibleContributions.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{formatKes(item.amount)}</TableCell>
                            <TableCell>{formatTimeInKenya(item.contributedAt)}</TableCell>
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

                  <LedgerPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={visibleContributions.length}
                    pageSize={LEDGER_PAGE_SIZE}
                    getHref={getLedgerPageHref}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
