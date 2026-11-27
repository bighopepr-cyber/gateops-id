import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";
type Context={params:Promise<{id:string}>};
export async function POST(_request:Request,{params}:Context){
 const access=await requireApiPermission("accounts-manage");if(access.response)return access.response;
 const {id}=await params;
 if(access.user?.id===id)return NextResponse.json({error:"Gunakan menu Ubah password untuk mengganti password akun sendiri."},{status:409});
 try{
  const account=await db.user.findUnique({where:{id},select:{id:true,username:true}});if(!account)return NextResponse.json({error:"Akun tidak ditemukan."},{status:404});
  const temporaryPassword=randomBytes(18).toString("base64url");
  const passwordHash=await argon2.hash(temporaryPassword,{type:argon2.argon2id});
  await db.$transaction(async tx=>{await tx.user.update({where:{id},data:{passwordHash,mustChangePassword:true}});await tx.session.deleteMany({where:{userId:id}});await writeAuditLog(tx,access.user!,{action:"ACCOUNT_PASSWORD_RESET",entityType:"ACCOUNT",entityId:id,metadata:{sessionsRevoked:true,mustChangeOnNextLogin:true}});});
  return NextResponse.json({data:{username:account.username,temporaryPassword,requiresChange:true}},{headers:{"Cache-Control":"no-store, private"}});
 }catch{return NextResponse.json({error:"Reset password gagal diproses."},{status:500});}
}
