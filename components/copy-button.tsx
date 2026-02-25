"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  getText: () => string;
};

export function CopyButton({ getText }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const text = getText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button type="button" variant="secondary" onClick={onCopy} disabled={!getText()}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
