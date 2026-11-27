import { describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "./audit-log";
import type { AuditActor } from "./audit-log";
import type { Prisma } from "@/generated/prisma/client";

const actor: AuditActor = {
  id: "actor-1",
  username: "admin",
  displayName: "Administrator",
  role: "SUPER_ADMIN"
};

describe("writeAuditLog", () => {
  it("writes actor snapshot and allowlisted event data through the supplied transaction", async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;

    await writeAuditLog(tx, actor, {
      action: "GATE_UPDATED",
      entityType: "GATE",
      entityId: "gate-1",
      metadata: { status: "NONAKTIF", changedFields: "status" }
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        actorUsername: "admin",
        actorDisplayName: "Administrator",
        actorRole: "SUPER_ADMIN",
        action: "GATE_UPDATED",
        entityType: "GATE",
        entityId: "gate-1",
        metadata: { status: "NONAKTIF", changedFields: "status" }
      }
    });
  });

  it.each(["password", "qrToken", "credential", "authorization"])(
    "rejects sensitive metadata key %s before writing",
    async key => {
      const create = vi.fn();
      const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;

      await expect(writeAuditLog(tx, actor, {
        action: "ACCOUNT_UPDATED",
        entityType: "ACCOUNT",
        entityId: "account-1",
        metadata: { [key]: "must-not-be-recorded" }
      })).rejects.toThrow("Audit metadata must not contain credentials or secrets.");

      expect(create).not.toHaveBeenCalled();
    }
  );
});
