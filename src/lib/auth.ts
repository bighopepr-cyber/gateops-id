import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canAccess } from "@/lib/permissions";
const COOKIE="gateops_session";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function createSession(userId:string){const token=randomBytes(32).toString("base64url");const expiresAt=new Date(Date.now()+12*60*60*1000);await db.session.create({data:{tokenHash:hash(token),userId,expiresAt}});(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:expiresAt});}
export async function getCurrentUser(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(!token)return null;const session=await db.session.findUnique({where:{tokenHash:hash(token)},include:{user:true}});if(!session)return null;if(session.expiresAt.getTime()<=Date.now()){await db.session.delete({where:{id:session.id}});jar.delete(COOKIE);return null;}return{id:session.user.id,username:session.user.username,displayName:session.user.displayName,role:session.user.role,mustChangePassword:session.user.mustChangePassword,sessionId:session.id,sessionExpiresAt:session.expiresAt};}
export async function destroySession(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(token)await db.session.deleteMany({where:{tokenHash:hash(token)}});jar.delete(COOKIE);}
export async function requireUser(){const user=await getCurrentUser();if(!user)redirect("/login");if(user.mustChangePassword)redirect("/change-password");return user;}
export async function requireRole(roles:readonly Role[]){const user=await requireUser();if(!roles.includes(user.role))redirect("/forbidden");if(user.mustChangePassword)redirect("/change-password");return user;}
export async function requirePermission(permission:string){const user=await requireUser();if(!canAccess(user.role,permission))redirect("/forbidden");if(user.mustChangePassword)redirect("/change-password");return user;}
