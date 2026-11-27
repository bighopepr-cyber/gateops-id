import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

const schema=z.object({
  nrp:z.string().trim().min(1).max(40),
  displayName:z.string().trim().min(1).max(160),
  username:z.string().trim().min(1).max(80),
  password:z.string().min(1).max(1024)
});

export async function POST(request:Request){
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:"NRP, nama, username, dan password wajib diisi dengan benar.",fields:parsed.error.flatten().fieldErrors},{status:422});
  const data=parsed.data;
  try{
    const user=await db.$transaction(async tx=>{const created=await tx.user.create({data:{role:"PERSIT",nrp:data.nrp,displayName:data.displayName,username:data.username,passwordHash:await argon2.hash(data.password,{type:argon2.argon2id})},select:{id:true,username:true,displayName:true,role:true,nrp:true,linkedPersonnelId:true}});await writeAuditLog(tx,{id:created.id,username:created.username,displayName:created.displayName,role:created.role},{action:"ACCOUNT_CREATED",entityType:"ACCOUNT",entityId:created.id,metadata:{role:"PERSIT",registrationMethod:"SELF_SERVICE"}});return created;});
    return NextResponse.json({data:{id:user.id,username:user.username,displayName:user.displayName,role:user.role,verificationStatus:"PENDING"}},{status:201});
  }catch(error){
    if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"Username sudah digunakan. Silakan pilih username lain."},{status:409});
    return NextResponse.json({error:"Registrasi tidak dapat diproses saat ini."},{status:500});
  }
}
