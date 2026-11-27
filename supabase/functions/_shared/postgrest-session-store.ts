import type { ActiveSessionRecord, SessionStore } from "./application-session.ts";
import type { AppRole } from "../../../src/lib/role-permissions.ts";
const runtimeEnv = (globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env;
type SessionRow = { id: string; user_id: string; expires_at: string };
type UserRow = { id: string; username: string; display_name: string; role: AppRole; must_change_password: boolean };

function resolveSecretKey(): string {
  const namedKeys = runtimeEnv?.get("SUPABASE_SECRET_KEYS");
  if (namedKeys) {
    try {
      const parsed: unknown = JSON.parse(namedKeys);
      if (parsed && typeof parsed === "object" && "default" in parsed && typeof parsed.default === "string") {
        return parsed.default;
      }
    } catch {
      throw new Error("Supabase secret key configuration is invalid");
    }
  }
  return runtimeEnv?.get("SUPABASE_SECRET_KEY") ?? runtimeEnv?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export class PostgrestSessionStore implements SessionStore {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  constructor(
    baseUrl = runtimeEnv?.get("SUPABASE_URL") ?? "",
    apiKey = resolveSecretKey(),
    private readonly request: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("Supabase database API environment is not configured");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }
  private async select<T>(table: string, query: URLSearchParams): Promise<T[]> {
    const response = await this.request(`${this.baseUrl}/rest/v1/${table}?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: this.apiKey,
        ...(this.apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase database query failed with status ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error("Supabase database returned an invalid response");
    return value as T[];
  }
  async findActiveSession(tokenHash: string, now: Date): Promise<ActiveSessionRecord | null> {
    const sessions = await this.select<SessionRow>("sessions", new URLSearchParams({
      select: "id,user_id,expires_at", token_hash: `eq.${tokenHash}`,
      expires_at: `gt.${now.toISOString()}`, limit: "1",
    }));
    const session = sessions[0];
    if (!session) return null;
    const users = await this.select<UserRow>("users", new URLSearchParams({
      select: "id,username,display_name,role,must_change_password", id: `eq.${session.user_id}`, limit: "1",
    }));
    const user = users[0];
    if (!user) return null;
    return {
      sessionId: session.id, userId: user.id, expiresAt: session.expires_at,
      username: user.username, displayName: user.display_name, role: user.role,
      mustChangePassword: user.must_change_password,
    };
  }
}
