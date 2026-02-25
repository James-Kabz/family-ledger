import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatKes(amount: number) {
  return `KES ${new Intl.NumberFormat("en-KE").format(amount)}`;
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeRef(ref: string | null | undefined) {
  if (!ref) return null;
  const value = ref.trim();
  return value.length ? value : null;
}
