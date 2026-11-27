export type AppRole = "SUPER_ADMIN" | "KOMANDAN" | "PERSONEL" | "PERSIT";

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["command-dashboard","personnel-read","personnel-manage","gate-manage","gps-read","activity-read-all","reports-create","accounts-manage","persit-verify","audit-read"],
  KOMANDAN: ["command-dashboard","personnel-read","gps-read","activity-read-all","reports-create"],
  PERSONEL: ["personal-dashboard","personal-activity-read","presence-transact","gps-update","password-change-own"],
  PERSIT: ["persit-dashboard","password-change-own"]
} as const satisfies Record<AppRole, readonly string[]>;

export function canAccessRole(role: AppRole, permission: string): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}
