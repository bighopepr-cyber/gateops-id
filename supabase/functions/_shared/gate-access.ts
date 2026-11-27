import { canAccessRole, type AppRole } from "../../../src/lib/role-permissions.ts";
export function canManageGates(role: AppRole): boolean {
  return role === "SUPER_ADMIN" && canAccessRole(role, "gate-manage");
}
