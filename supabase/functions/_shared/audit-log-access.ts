import { canAccessRole, type AppRole } from "../../../src/lib/role-permissions.ts";

export function canReadAuditLogs(role: AppRole): boolean {
  return role === "SUPER_ADMIN" && canAccessRole(role, "audit-read");
}
