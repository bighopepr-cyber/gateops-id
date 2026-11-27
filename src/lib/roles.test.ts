import { describe,expect,it } from "vitest";
import type { Role } from "@/generated/prisma/client";
import { canAccess } from "./permissions";
describe("role access policy",()=>{
 it("allows command monitoring only for Super Admin and Komandan",()=>{expect(canAccess("SUPER_ADMIN","command-dashboard")).toBe(true);expect(canAccess("KOMANDAN","command-dashboard")).toBe(true);expect(canAccess("PERSONEL","command-dashboard")).toBe(false);expect(canAccess("PERSIT","command-dashboard")).toBe(false);});
 it("reserves management and Persit verification to Super Admin",()=>{for(const role of ["KOMANDAN","PERSONEL","PERSIT"] as Role[]){expect(canAccess(role,"personnel-manage")).toBe(false);expect(canAccess(role,"accounts-manage")).toBe(false);expect(canAccess(role,"persit-verify")).toBe(false);}});
 it("allows Komandan to read personnel but not mutate it",()=>{expect(canAccess("KOMANDAN","personnel-read")).toBe(true);expect(canAccess("KOMANDAN","personnel-manage")).toBe(false);});
 it("allows only Super Admin to read audit logs",()=>{expect(canAccess("SUPER_ADMIN","audit-read")).toBe(true);for(const role of ["KOMANDAN","PERSONEL","PERSIT"] as Role[])expect(canAccess(role,"audit-read")).toBe(false);});
 it("allows only Super Admin to manage accounts",()=>{expect(canAccess("SUPER_ADMIN","accounts-manage")).toBe(true);for(const role of ["KOMANDAN","PERSONEL","PERSIT"] as Role[])expect(canAccess(role,"accounts-manage")).toBe(false);});
 it("does not grant GPS, global activity or reports to Personel and Persit",()=>{for(const role of ["PERSONEL","PERSIT"] as Role[]){expect(canAccess(role,"gps-read")).toBe(false);expect(canAccess(role,"activity-read-all")).toBe(false);expect(canAccess(role,"reports-create")).toBe(false);}});
 it("grants personal functions to Personel and linked-personnel view to Persit",()=>{expect(canAccess("PERSONEL","presence-transact")).toBe(true);expect(canAccess("PERSONEL","personal-activity-read")).toBe(true);expect(canAccess("PERSIT","persit-dashboard")).toBe(true);expect(canAccess("PERSIT","personal-activity-read")).toBe(false);});
});
