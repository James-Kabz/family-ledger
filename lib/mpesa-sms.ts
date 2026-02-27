import { normalizeName } from "@/lib/utils";

export type ParsedMpesaSms = {
  ref?: string;
  name?: string;
  amount?: number;
  contributedAt?: string;
};

function parseAmount(raw: string) {
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function parseDateTime(text: string) {
  const match = text.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return undefined;

  let [, dd, mm, yy, h, min, meridiem] = match;
  let year = Number(yy);
  if (year < 100) year += 2000;
  let hour = Number(h);
  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === "PM" && hour < 12) hour += 12;
    if (upper === "AM" && hour === 12) hour = 0;
  }

  const date = new Date(year, Number(mm) - 1, Number(dd), hour, Number(min), 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function extractName(raw: string) {
  // Example: "from EMMA WANJIRU 0723... on"
  const match = raw.match(/from\s+(.+?)\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i);
  if (!match) return undefined;

  let candidate = match[1]
    .replace(/\b(\+?254|0)\d{8,9}\b/g, "")
    .replace(/\*+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!candidate) return undefined;
  return normalizeName(candidate);
}

export function parseMpesaReceivedMessage(text: string): ParsedMpesaSms {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return {};

  if (!/you have received/i.test(normalized)) {
    return {};
  }

  const ref = normalized.match(/^([A-Z0-9]{8,15})\b/i)?.[1];
  const amount = normalized.match(/received\s+Ksh\.?\s*([\d,]+(?:\.\d+)?)/i)?.[1];

  return {
    ref,
    name: extractName(normalized),
    amount: amount ? parseAmount(amount) : undefined,
    contributedAt: parseDateTime(normalized),
  };
}
