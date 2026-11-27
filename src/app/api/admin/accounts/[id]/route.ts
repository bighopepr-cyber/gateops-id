import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";
const schema=z.object({
 username:z.string().trim().min(1).max(80).optional(),
 displayName:z.string().trim().min(1).max(160).optional(),
 nrp:z.string().trim().max(40).nullable().optional(),
 rank:z.string().trim().max(100).nullable().optional(),
 position:z.string().trim().max(160).nullable().optional()
}).refine(v=>Object.keys(v).length>0);
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){
 const access=await requireApiPermission("accounts-manage");if(access.response)return access.response;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Data perubahan tidak valid.",fields:parsed.error.flatten().fieldErrors},{status:422});
 const {id}=await params;
 try{
 const updated=await db.$transaction(async tx=>{
  const existing=await tx.user.findUnique({where:{id},select:{id:true}});
  if(!existing)return null;
  const changed=await tx.user.update({where:{id},data:parsed.data,select:{id:true,username:true,role:true,displayName:true,nrp:true,rank:true,position:true,mustChangePassword:true,createdAt:true,updatedAt:true}});
  await writeAuditLog(tx,access.user!,{action:"ACCOUNT_UPDATED",entityType:"ACCOUNT",entityId:id,metadata:{changedFields:Object.keys(parsed.data).sort().join(",")}});
  return changed;
 });
 if(!updated)return NextResponse.json({error:"Akun tidak ditemukan."},{status:404});
 return NextResponse.json({data:updated});
 }catch(error){if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"Username sudah digunakan oleh akun lain."},{status:409});return NextResponse.json({error:"Perubahan akun gagal disimpan."},{status:500});}
}
