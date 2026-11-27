import type { AppRole } from "../../../src/lib/role-permissions.ts";

export type ApplicationUser = {
  id: string; username: string; displayName: string; role: AppRole;
  mustChangePassword: boolean; sessionId: string; sessionExpiresAt: string;
};
export type ActiveSessionRecord = {
  sessionId: string; userId: string; expiresAt: string; username: string;
  displayName: string; role: AppRole; mustChangePassword: boolean;
};
export interface SessionStore {
  findActiveSession(tokenHash: string, now: Date): Promise<ActiveSessionRecord | null>;
}
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const matches = cookieHeader.split(";").map(part => part.trim()).filter(part => part.startsWith("gateops_session="));
  if (matches.length !== 1) return null;
  const token = matches[0].slice("gateops_session=".length);
  return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
}
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function resolveApplicationSession(store: SessionStore, token: string, now = new Date()): Promise<ApplicationUser | null> {
  const record = await store.findActiveSession(await hashSessionToken(token), now);
  if (!record) return null;
  return {
    id: record.userId, username: record.username, displayName: record.displayName, role: record.role,
    mustChangePassword: record.mustChangePassword, sessionId: record.sessionId,
    sessionExpiresAt: new Date(record.expiresAt).toISOString(),
  };
}
