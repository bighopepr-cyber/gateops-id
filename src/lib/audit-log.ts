import type { Prisma, Role } from "@/generated/prisma/client";

export type AuditActor = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};

export type AuditEvent = {
  action:
    | "ACCOUNT_CREATED"
    | "ACCOUNT_UPDATED"
    | "ACCOUNT_PASSWORD_RESET"
    | "ACCOUNT_PASSWORD_CHANGED"
    | "PERSONNEL_CREATED"
    | "PERSONNEL_UPDATED"
    | "PERSONNEL_DELETED"
    | "GATE_CREATED"
    | "GATE_UPDATED"
    | "PERSIT_LINK_VERIFIED"
    | "PRESENCE_EXIT"
    | "PRESENCE_RETURN";
  entityType: "ACCOUNT" | "PERSONNEL" | "GATE" | "PERSIT_LINK" | "ACTIVITY";
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const forbiddenMetadataKey = /(password|token|secret|cookie|credential|hash|authorization)/i;

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  event: AuditEvent
): Promise<void> {
  const metadata = event.metadata ?? {};
  if (Object.keys(metadata).some(key => forbiddenMetadataKey.test(key))) {
    throw new Error("Audit metadata must not contain credentials or secrets.");
  }

  await tx.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorRole: actor.role,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata
    }
  });
}
