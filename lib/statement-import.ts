import "server-only";

export type ParsedStatementContribution = {
  name: string;
  amount: number;
  contributedAt?: string;
  ref?: string;
  rawSnippet: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseAmountToKesInt(value: string): number | null {
  const cleaned = value.replace(/KES\s*/gi, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

function parseDateTime(value: string): string | undefined {
  const trimmed = value.trim();

  // ISO-like: 2026-02-25 13:31:20
  let match = trimmed.match(/(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? "0"));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  // d/m/yy hh:mm[:ss] [AM|PM]
  match = trimmed.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i,
  );
  if (match) {
    let [, d, m, y, hh, mm, ss, meridiem] = match;
    let year = Number(y);
    if (year < 100) year += 2000;
    let hour = Number(hh);
    if (meridiem) {
      const upper = meridiem.toUpperCase();
      if (upper === "PM" && hour < 12) hour += 12;
      if (upper === "AM" && hour === 12) hour = 0;
    }
    const date = new Date(year, Number(m) - 1, Number(d), hour, Number(mm), Number(ss ?? "0"));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return undefined;
}

function extractFirstDateTimeCandidate(block: string): string | undefined {
  const patterns = [
    /\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?/g,
    /\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi,
  ];

  for (const pattern of patterns) {
    const matches = block.match(pattern);
    if (!matches) continue;
    for (const candidate of matches) {
      const parsed = parseDateTime(candidate);
      if (parsed) return parsed;
    }
  }

  return undefined;
}

function extractReceiptRef(block: string): string | undefined {
  // Typical M-Pesa receipt codes are uppercase alphanumeric tokens; choose the first likely token.
  const tokens = block.match(/\b[A-Z0-9]{8,15}\b/g) ?? [];
  const banned = new Set(["COMPLETED", "SUCCESSFUL", "CONFIRMED", "RECEIVED"]);
  return tokens.find((token) => !banned.has(token));
}

function extractAmountNearPhrase(block: string, phraseIndex: number): number | null {
  const amountRegex = /(?:KES\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/gi;
  const candidates: Array<{ amount: number; index: number; raw: string }> = [];

  for (const match of block.matchAll(amountRegex)) {
    const rawToken = match[0];
    const start = match.index ?? 0;

    const before = block.slice(Math.max(0, start - 1), start);
    const after = block.slice(start + rawToken.length, start + rawToken.length + 1);
    if (before === "/" || after === "/" || before === ":" || after === ":") continue;

    const parsed = parseAmountToKesInt(rawToken);
    if (!parsed) continue;
    if (parsed < 10) continue;

    candidates.push({ amount: parsed, index: start, raw: rawToken });
  }

  if (!candidates.length) return null;

  const afterPhrase = candidates.filter((candidate) => candidate.index >= phraseIndex);
  const preferred = afterPhrase.length ? afterPhrase : candidates;

  // Safaricom rows often contain multiple monetary columns (paid in / withdrawn / balance).
  // Pick the first reasonable amount after the "Funds received from" phrase.
  return preferred[0]?.amount ?? null;
}

function extractPaidInAmountFromCompleted(block: string): number | null {
  const completedMatch = /COMPLETED([\s\S]*)/i.exec(block);
  if (!completedMatch) return null;
  const tail = completedMatch[1].replace(/\|/g, " ");
  const amountRegex = /(?:KES\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g;

  for (const match of tail.matchAll(amountRegex)) {
    const parsed = parseAmountToKesInt(match[0]);
    if (!parsed) continue;
    return parsed; // first amount after COMPLETED = Paid In for these statement rows
  }

  return null;
}

function extractNameFromBlock(block: string): string | null {
  const phraseMatch = /Funds received from\s+/i.exec(block);
  if (!phraseMatch) return null;

  const start = phraseMatch.index + phraseMatch[0].length;
  let tail = block.slice(start).replace(/\|/g, " ");

  // Remove masked/visible sender phone number prefix, e.g. "254713***641 - " or "0724***037 - "
  tail = tail.replace(/^\s*\+?\d[\d*\s-]{5,30}\s*-\s*/i, "");

  const stopWords = [
    "Completed",
    "Successful",
    "Confirmed",
    "Transaction",
    "Balance",
    "Paid In",
    "Withdrawn",
    "Status",
    "KES",
  ];

  let end = tail.length;
  for (const word of stopWords) {
    const idx = tail.search(new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "i"));
    if (idx >= 0) end = Math.min(end, idx);
  }

  const candidate = normalizeWhitespace(tail.slice(0, end));
  if (!candidate) return null;

  const cleaned = normalizeWhitespace(
    candidate
      .replace(/^[\-:]+/, "")
      .replace(/\bCOMPLETED[\s\S]*$/i, "")
      .replace(/(?:KES\s*)?\d[\d,.\s]*$/i, "")
      .replace(/\s+-\s*$/, ""),
  );

  return cleaned || null;
}

export function parseSafaricomStatementText(text: string): ParsedStatementContribution[] {
  const rawLines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lines = rawLines.map((line) => normalizeWhitespace(line));
  const results: ParsedStatementContribution[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!/Funds received from/i.test(lines[i])) continue;

    const blockLines = [lines[i]];
    for (let j = i + 1; j < lines.length && blockLines.length < 6; j += 1) {
      blockLines.push(lines[j]);
      if (/COMPLETED/i.test(lines[j])) break;
    }
    const block = blockLines.join(" | ");
    const phraseIndex = /Funds received from/i.exec(block)?.index ?? 0;
    const name = extractNameFromBlock(block);
    const amount = extractPaidInAmountFromCompleted(block) ?? extractAmountNearPhrase(block, phraseIndex);

    if (!name || !amount) continue;

    results.push({
      name,
      amount,
      contributedAt: extractFirstDateTimeCandidate(block),
      ref: extractReceiptRef(block),
      rawSnippet: block,
    });
  }

  const deduped = new Map<string, ParsedStatementContribution>();
  for (const item of results) {
    const key = [item.ref ?? "", item.name.toLowerCase(), item.amount, item.contributedAt ?? ""].join("|");
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return [...deduped.values()].sort((a, b) => {
    const aMs = a.contributedAt ? new Date(a.contributedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bMs = b.contributedAt ? new Date(b.contributedAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const mod = (await import("pdf-parse")) as any;
  const pdfParse = mod.default ?? mod;
  const parsed = await pdfParse(buffer);
  const text = typeof parsed?.text === "string" ? parsed.text : "";
  return text;
}
