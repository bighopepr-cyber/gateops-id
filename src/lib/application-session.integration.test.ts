import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { hashSessionToken, readSessionCookie, resolveApplicationSession, type SessionStore } from "../../supabase/functions/_shared/application-session";
import type { AppRole } from "./role-permissions";

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, max: 2 }) : null;

const store: SessionStore = {
  async findActiveSession(tokenHash: string, now: Date) {
    if (!pool) throw new Error("DATABASE_URL is required for the PostgreSQL integration test");
    const result = await pool.query<{
      [column: string]: unknown;
      session_id: string; user_id: string; expires_at: Date; username: string;
      display_name: string; role: AppRole; must_change_password: boolean;
    }>(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, u.username, u.display_name, u.role, u.must_change_password
         FROM sessions s INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > $2 LIMIT 1`,
      [tokenHash, now],
    );
    const row = result.rows[0];
    return row ? {
      sessionId: row.session_id, userId: row.user_id, expiresAt: row.expires_at.toISOString(),
      username: row.username, displayName: row.display_name, role: row.role,
      mustChangePassword: row.must_change_password,
    } : null;
  },
};

afterAll(async () => { await pool?.end(); });

describe("GATEOPS opaque application session against PostgreSQL", () => {
  it("parses only one well-formed opaque session cookie", () => {
    const token = "A".repeat(43);
    expect(readSessionCookie(`other=value; gateops_session=${token}`)).toBe(token);
    expect(readSessionCookie(`gateops_session=${token}; gateops_session=${token}`)).toBeNull();
    expect(readSessionCookie("gateops_session=malformed token")).toBeNull();
  });

  it("resolves only a persisted, unexpired session and existing user", async () => {
    if (!pool) throw new Error("DATABASE_URL is required for the PostgreSQL integration test");
    const suffix = crypto.randomUUID();
    const userId = `edge-test-user-${suffix}`;
    const validSessionId = `edge-test-valid-${suffix}`;
    const expiredSessionId = `edge-test-expired-${suffix}`;
    const username = `edge-test-${suffix}`;
    const validToken = `valid_${crypto.randomUUID().replaceAll("-", "")}_session_token`;
    const expiredToken = `expired_${crypto.randomUUID().replaceAll("-", "")}_session_token`;

    try {
      await pool.query(
        "INSERT INTO users (id, username, password_hash, role, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
        [userId, username, "not-a-login-credential", "KOMANDAN", "Edge Integration Test"],
      );
      await pool.query(
        "INSERT INTO sessions (id, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4), ($5, $6, $3, $7)",
        [
          validSessionId, await hashSessionToken(validToken), userId, new Date(Date.now() + 60_000),
          expiredSessionId, await hashSessionToken(expiredToken), new Date(Date.now() - 60_000),
        ],
      );
      const valid = await resolveApplicationSession(store, validToken);
      expect(valid).toMatchObject({ id: userId, username, displayName: "Edge Integration Test", role: "KOMANDAN" });
      expect(await resolveApplicationSession(store, expiredToken)).toBeNull();
      expect(await resolveApplicationSession(store, "unknown_session_token_value_12345678901234567890")).toBeNull();
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  });
});
