"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createContributionAction, type ContributionFormState } from "@/lib/actions";
import { parseMpesaReceivedMessage } from "@/lib/mpesa-sms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";

const initialState: ContributionFormState = {};

function formatThousands(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-KE");
}

export function ContributionForm() {
  const [state, action] = useActionState(createContributionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [smsText, setSmsText] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [parsedRef, setParsedRef] = useState("");
  const [parsedAt, setParsedAt] = useState("");
  const [note, setNote] = useState("");
  const [pledged, setPledged] = useState(false);
  const [parseHint, setParseHint] = useState("");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setSmsText("");
      setName("");
      setAmount("");
      setParsedRef("");
      setParsedAt("");
      setNote("");
      setPledged(false);
      setParseHint("");
    }
  }, [state.success]);

  function extractFromSms() {
    const parsed = parseMpesaReceivedMessage(smsText);
    if (!parsed.name || !parsed.amount) {
      setParseHint("Could not detect name and amount from the pasted SMS.");
      return;
    }

    setName(parsed.name);
    setAmount(formatThousands(String(parsed.amount)));
    setParsedRef(parsed.ref ?? "");
    setParsedAt(parsed.contributedAt ?? "");
    setParseHint("Detected name and amount from SMS.");
  }

  function autoExtractFromSms(raw: string) {
    const parsed = parseMpesaReceivedMessage(raw);
    if (!parsed.name || !parsed.amount) return;
    setName((prev) => (prev.trim().length ? prev : parsed.name ?? prev));
    setAmount((prev) => (prev.trim().length ? prev : formatThousands(String(parsed.amount ?? prev))));
    setParsedRef((prev) => (prev.trim().length ? prev : (parsed.ref ?? prev)));
    setParsedAt((prev) => (prev.trim().length ? prev : (parsed.contributedAt ?? prev)));
    setParseHint("Auto-detected name and amount from SMS.");
  }

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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="smsText">Paste M-Pesa confirmation SMS (optional)</Label>
            <Textarea
              id="smsText"
              name="smsText"
              rows={3}
              placeholder="UBR7L7TLNN Confirmed.You have received Ksh10,000.00 from EMMA WANJIRU 0723... on 27/2/26 at 8:46 AM..."
              value={smsText}
              onChange={(event) => setSmsText(event.target.value)}
              onBlur={(event) => autoExtractFromSms(event.target.value)}
              onPaste={(event) => {
                const target = event.currentTarget;
                setTimeout(() => autoExtractFromSms(target.value), 0);
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Extracts sender name and received amount automatically.</p>
              <Button type="button" variant="outline" size="sm" onClick={extractFromSms}>
                Extract from SMS
              </Button>
            </div>
            {parseHint ? <p className="text-xs text-muted-foreground">{parseHint}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Jane Wanjiku" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              name="amount"
              type="text"
              inputMode="numeric"
              placeholder="1,000"
              required
              value={amount}
              onChange={(event) => setAmount(formatThousands(event.target.value))}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              name="note"
              rows={3}
              placeholder="Burial committee contribution"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Switch id="pledged" name="pledged" checked={pledged} onCheckedChange={setPledged} />
              <div>
                <Label htmlFor="pledged">Mark as pledge</Label>
                <p className="text-xs text-muted-foreground">
                  Pledges are tracked separately in records but still included in totals and WhatsApp updates.
                </p>
              </div>
            </div>
          </div>

          <input type="hidden" name="ref" value={parsedRef} />
          <input type="hidden" name="contributedAt" value={parsedAt} />

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
