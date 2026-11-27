import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, max: 2 }) : null;
afterAll(async () => { await pool?.end(); });
describe("Gate management PostgreSQL RPC", () => {
  it("creates and updates Gate with atomic audit records while preserving QR hash", async () => {
    if (!pool) throw new Error("DATABASE_URL is required for Gate RPC integration tests");
    const suffix = crypto.randomUUID();
    const actorId = `gate-rpc-actor-${suffix}`;
    const gateId = `gate-rpc-${suffix}`;
    const username = `gate-rpc-${suffix}`;
    const qrHash = "a".repeat(64);
    try {
      await pool.query(
        "INSERT INTO users (id, username, password_hash, role, display_name, created_at, updated_at) VALUES ($1,$2,$3,'SUPER_ADMIN',$4,NOW(),NOW())",
        [actorId, username, "not-a-login-credential", "Gate RPC Integration"],
      );
      const created = await pool.query(
        "SELECT * FROM gateops_create_gate($1,$2,$3,'AKTIF',$4,$5,$6,$7,'SUPER_ADMIN')",
        [gateId, "Gate RPC", "Pos RPC", qrHash, actorId, username, "Gate RPC Integration"],
      );
      expect(created.rows[0]).toMatchObject({ id: gateId, name: "Gate RPC", location: "Pos RPC", status: "AKTIF" });
      const createdAudit = await pool.query("SELECT action, entity_type, entity_id, metadata FROM audit_logs WHERE entity_id=$1", [gateId]);
      expect(createdAudit.rows).toHaveLength(1);
      expect(createdAudit.rows[0]).toMatchObject({ action: "GATE_CREATED", entity_type: "GATE", metadata: { name: "Gate RPC", status: "AKTIF" } });
      const updated = await pool.query(
        "SELECT * FROM gateops_update_gate($1,$2,$3,'NONAKTIF',$4,$5,$6,'SUPER_ADMIN')",
        [gateId, "Gate RPC Updated", "Pos RPC Updated", actorId, username, "Gate RPC Integration"],
      );
      expect(updated.rows[0]).toMatchObject({ id: gateId, name: "Gate RPC Updated", status: "NONAKTIF" });
      const stored = await pool.query("SELECT qr_token_hash FROM gates WHERE id=$1", [gateId]);
      expect(String(stored.rows[0].qr_token_hash).trim()).toBe(qrHash);
      const audits = await pool.query("SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY created_at", [gateId]);
      expect(audits.rows.map(row => row.action)).toEqual(["GATE_CREATED", "GATE_UPDATED"]);
    } finally {
      await pool.query("DELETE FROM gates WHERE id=$1", [gateId]);
      await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [gateId]);
      await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    }
  });

  it("rolls back Gate insertion when its audit write fails", async () => {
    if (!pool) throw new Error("DATABASE_URL is required for Gate RPC integration tests");
    const suffix = crypto.randomUUID();
    const actorId = `gate-rpc-rollback-actor-${suffix}`;
    const gateId = `gate-rpc-rollback-${suffix}`;
    const username = `gate-rpc-rollback-${suffix}`;
    const triggerName = `gate_rpc_fail_audit_${suffix.replaceAll("-", "")}`;
    const functionName = `gate_rpc_fail_fn_${suffix.replaceAll("-", "")}`;
    try {
      await pool.query(
        "INSERT INTO users (id, username, password_hash, role, display_name, created_at, updated_at) VALUES ($1,$2,$3,'SUPER_ADMIN',$4,NOW(),NOW())",
        [actorId, username, "not-a-login-credential", "Gate RPC Rollback"],
      );
      await pool.query(`CREATE FUNCTION public.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF NEW.action = 'GATE_CREATED' AND NEW.entity_id = '${gateId}' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END; $fn$`);
      await pool.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`);
      await expect(pool.query(
        "SELECT * FROM gateops_create_gate($1,$2,$3,'AKTIF',$4,$5,$6,$7,'SUPER_ADMIN')",
        [gateId, "Gate Rollback", "Pos Rollback", "b".repeat(64), actorId, username, "Gate RPC Rollback"],
      )).rejects.toThrow("injected audit failure");
      const gate = await pool.query("SELECT id FROM gates WHERE id=$1", [gateId]);
      expect(gate.rows).toHaveLength(0);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_logs`);
      await pool.query(`DROP FUNCTION IF EXISTS public.${functionName}()`);
      await pool.query("DELETE FROM gates WHERE id=$1", [gateId]);
      await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [gateId]);
      await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    }
  });
});
