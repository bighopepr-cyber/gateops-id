import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";
const schema=z.object({
 nrp:z.string().trim().min(1).max(40),
 displayName:z.string().trim().min(1).max(160),
 rank:z.string().trim().min(1).max(100),
 position:z.string().trim().min(1).max(160),
 username:z.string().trim().min(1).max(80),
 password:z.string().min(1).max(1024)
});
const select={id:true,username:true,displayName:true,nrp:true,rank:true,position:true,mustChangePassword:true,createdAt:true,updatedAt:true} as const;
export async function GET(){
 const access=await requireApiPermission("personnel-read");if(access.response)return access.response;
 try{const data=await db.user.findMany({where:{role:"PERSONEL"},select,orderBy:{displayName:"asc"}});return NextResponse.json({data});}
 catch{return NextResponse.json({error:"Data personel tidak dapat dimuat."},{status:500});}
}
export async function POST(request:Request){
 const access=await requireApiPermission("personnel-manage");if(access.response)return access.response;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Lengkapi seluruh data personel dengan benar.",fields:parsed.error.flatten().fieldErrors},{status:422});
 try{const d=parsed.data;const data=await db.$transaction(async tx=>{const created=await tx.user.create({data:{role:"PERSONEL",username:d.username,displayName:d.displayName,nrp:d.nrp,rank:d.rank,position:d.position,passwordHash:await argon2.hash(d.password,{type:argon2.argon2id})},select});await writeAuditLog(tx,access.user!,{action:"PERSONNEL_CREATED",entityType:"PERSONNEL",entityId:created.id,metadata:{role:"PERSONEL"}});return created;});return NextResponse.json({data},{status:201});}
 catch(error){if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"Username sudah digunakan. Gunakan username lain."},{status:409});return NextResponse.json({error:"Data personel gagal disimpan."},{status:500});}
}
