import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "family_ledger_session";
const SESSION_PAYLOAD = "admin";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "changeme";
}

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? getAdminPassword();
}

function buildToken() {
  return createHmac("sha256", getSessionSecret()).update(SESSION_PAYLOAD).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  return safeEqualHex(value, buildToken());
}

export async function requireAuth() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login");
  }
}

export async function requireGuest() {
  const authed = await isAuthenticated();
  if (authed) {
    redirect("/");
  }
}

export async function createSession() {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: buildToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export function verifyAdminPassword(password: string) {
  return password === getAdminPassword();
}
