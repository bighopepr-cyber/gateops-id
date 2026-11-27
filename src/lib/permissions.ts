import type { Role } from "@/generated/prisma/client";
import { canAccessRole, ROLE_PERMISSIONS } from "./role-permissions";
export { ROLE_PERMISSIONS };
export function canAccess(role: Role, permission: string): boolean {
  return canAccessRole(role, permission);
}
