import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";
const schema=z.object({nrp:z.string().trim().min(1).max(40),displayName:z.string().trim().min(1).max(160),rank:z.string().trim().min(1).max(100),position:z.string().trim().min(1).max(160),username:z.string().trim().min(1).max(80)});
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 const access=await requireApiPermission("personnel-read");if(access.response)return access.response;
 const {id}=await params;try{const data=await db.user.findFirst({where:{id,role:"PERSONEL"},select:{id:true,username:true,displayName:true,nrp:true,rank:true,position:true,mustChangePassword:true,createdAt:true,updatedAt:true}});if(!data)return NextResponse.json({error:"Personel tidak ditemukan."},{status:404});return NextResponse.json({data});}catch{return NextResponse.json({error:"Detail personel tidak dapat dimuat."},{status:500});}
}
export async function PATCH(request:Request,{params}:Context){
 const access=await requireApiPermission("personnel-manage");if(access.response)return access.response;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Periksa kembali data personel.",fields:parsed.error.flatten().fieldErrors},{status:422});
 const {id}=await params;try{const d=parsed.data;const data=await db.$transaction(async tx=>{const existing=await tx.user.findFirst({where:{id,role:"PERSONEL"},select:{id:true}});if(!existing)return null;const updated=await tx.user.update({where:{id},data:{nrp:d.nrp,displayName:d.displayName,rank:d.rank,position:d.position,username:d.username},select:{id:true,username:true,displayName:true,nrp:true,rank:true,position:true,mustChangePassword:true,createdAt:true,updatedAt:true}});await writeAuditLog(tx,access.user!,{action:"PERSONNEL_UPDATED",entityType:"PERSONNEL",entityId:id,metadata:{changedFields:"displayName,nrp,position,rank,username"}});return updated;});if(!data)return NextResponse.json({error:"Personel tidak ditemukan."},{status:404});return NextResponse.json({data});}
 catch(error){if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"Username sudah digunakan. Gunakan username lain."},{status:409});return NextResponse.json({error:"Perubahan personel gagal disimpan."},{status:500});}
}


export async function DELETE(_request:Request,{params}:Context){
 const access=await requireApiPermission("personnel-manage");if(access.response)return access.response;
 const {id}=await params;
 try{
  const result=await db.$transaction(async tx=>{
   const personnel=await tx.user.findFirst({where:{id,role:"PERSONEL"},select:{id:true,displayName:true,nrp:true}});
   if(!personnel)return null;
   const persit=await tx.user.deleteMany({where:{role:"PERSIT",linkedPersonnelId:id}});
   await tx.user.delete({where:{id}});
   await writeAuditLog(tx,access.user!,{action:"PERSONNEL_DELETED",entityType:"PERSONNEL",entityId:id,metadata:{deletedPersitAccounts:persit.count}});
   return {personnel,persitAccountsDeleted:persit.count};
  });
  if(!result)return NextResponse.json({error:"Personel tidak ditemukan."},{status:404});
  return NextResponse.json({data:{deletedPersonnelId:result.personnel.id,deletedPersitAccounts:result.persitAccountsDeleted,message:"Personel, akun Persit terhubung, dan seluruh sesi login terkait berhasil dihapus."}});
 }catch{
  return NextResponse.json({error:"Penghapusan personel gagal. Tidak ada data yang dihapus."},{status:500});
 }
}
