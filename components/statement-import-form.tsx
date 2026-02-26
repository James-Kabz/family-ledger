"use client";

import { useActionState, useEffect, useRef } from "react";

import { importStatementPdfAction, type StatementImportState } from "@/lib/actions";
import { formatDateTime, formatKes } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: StatementImportState = {};

export function StatementImportForm() {
  const [state, action] = useActionState(importStatementPdfAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Safaricom statement PDF</CardTitle>
        <CardDescription>
          Imports only transactions whose details contain <span className="font-medium">Funds received from</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="statementPdf">Statement PDF</Label>
            <Input id="statementPdf" name="statementPdf" type="file" accept=".pdf,application/pdf" required />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Importing...">Import PDF</SubmitButton>
          </div>
        </form>

        {state.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-sm font-medium text-emerald-800">
              Imported {state.importedCount ?? 0} of {state.detectedCount ?? 0} detected transaction(s)
              {state.skippedCount ? `, skipped ${state.skippedCount}` : ""}.
            </p>

            {state.warnings?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
                {state.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {state.preview?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detected preview</p>
                <div className="space-y-2">
                  {state.preview.map((item, index) => (
                    <div key={`${item.ref ?? "no-ref"}-${index}`} className="rounded-md border bg-background px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span>{formatKes(item.amount)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.contributedAt ? formatDateTime(item.contributedAt) : "Time not parsed"}
                        {item.ref ? ` • Ref ${item.ref}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
