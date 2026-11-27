import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";

const schema=z.object({personnelId:z.string().min(1)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await requireApiPermission("persit-verify");if(access.response)return access.response;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Pilih personel yang akan dihubungkan."},{status:422});
 const {id}=await params;
 try{
  const result=await db.$transaction(async tx=>{
   const persit=await tx.user.findFirst({where:{id,role:"PERSIT",linkedPersonnelId:null},select:{id:true,nrp:true}});
   if(!persit)return {kind:"not-found" as const};
   if(!persit.nrp)return {kind:"mismatch" as const};
   const personnel=await tx.user.findFirst({where:{id:parsed.data.personnelId,role:"PERSONEL",nrp:persit.nrp},select:{id:true}});
   if(!personnel)return {kind:"mismatch" as const};
   const existingLink=await tx.user.count({where:{role:"PERSIT",linkedPersonnelId:personnel.id}});
   if(existingLink>0)return {kind:"already-linked" as const};
   const updated=await tx.user.updateMany({where:{id:persit.id,role:"PERSIT",linkedPersonnelId:null,nrp:persit.nrp},data:{linkedPersonnelId:personnel.id}});
   if(updated.count!==1)return {kind:"conflict" as const};
   await writeAuditLog(tx,access.user!,{action:"PERSIT_LINK_VERIFIED",entityType:"PERSIT_LINK",entityId:persit.id,metadata:{personnelId:personnel.id}});
   return {kind:"approved" as const,personnelId:personnel.id};
  },{isolationLevel:"Serializable"});
  if(result.kind==="not-found")return NextResponse.json({error:"Permintaan tidak ditemukan atau sudah diverifikasi."},{status:404});
  if(result.kind==="mismatch")return NextResponse.json({error:"Personel yang dipilih tidak cocok dengan NRP pada permintaan."},{status:422});
  if(result.kind==="already-linked")return NextResponse.json({error:"NRP ini sudah memiliki akun Persit terhubung. Pengaitan tambahan masih menunggu keputusan Owner."},{status:409});
  if(result.kind==="conflict")return NextResponse.json({error:"Permintaan telah berubah. Muat ulang daftar verifikasi."},{status:409});
  return NextResponse.json({data:{verified:true,personnelId:result.personnelId}});
 }catch(error){if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2034")return NextResponse.json({error:"Permintaan lain sedang mengubah pengaitan NRP ini. Muat ulang daftar."},{status:409});return NextResponse.json({error:"Verifikasi gagal disimpan. Coba muat ulang daftar."},{status:500});}
}
