import { clsx, type ClassValue } from "clsx";

const KENYA_TIMEZONE = "Africa/Nairobi";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatKes(amount: number) {
  return `KES ${new Intl.NumberFormat("en-KE").format(amount)}`;
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KENYA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")} ${lookup("hour")}:${lookup("minute")}`;
}

export function formatTimeInKenya(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KENYA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeRef(ref: string | null | undefined) {
  if (!ref) return null;
  const value = ref.trim();
  return value.length ? value : null;
}
