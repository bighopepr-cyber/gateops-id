import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { Role } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit-log";

const createSchema=z.object({
 username:z.string().trim().min(1).max(80),
 password:z.string().min(1).max(1024),
 role:z.enum(["SUPER_ADMIN","KOMANDAN","PERSONEL"]),
 displayName:z.string().trim().min(1).max(160),
 nrp:z.string().trim().max(40).optional().default(""),
 rank:z.string().trim().max(100).optional().default(""),
 position:z.string().trim().max(160).optional().default("")
}).superRefine((value,ctx)=>{
 if(value.role!=="SUPER_ADMIN"){
  if(!value.nrp)ctx.addIssue({code:"custom",path:["nrp"],message:"NRP wajib diisi."});
  if(!value.rank)ctx.addIssue({code:"custom",path:["rank"],message:"Pangkat wajib diisi."});
  if(!value.position)ctx.addIssue({code:"custom",path:["position"],message:"Jabatan wajib diisi."});
 }
});
const safeSelect={id:true,username:true,role:true,displayName:true,nrp:true,rank:true,position:true,mustChangePassword:true,createdAt:true,updatedAt:true} as const;

export async function GET(){
 const access=await requireApiPermission("accounts-manage");if(access.response)return access.response;
 try{const accounts=await db.user.findMany({select:safeSelect,orderBy:[{role:"asc"},{displayName:"asc"}]});return NextResponse.json({data:accounts});}
 catch{return NextResponse.json({error:"Data akun tidak dapat dimuat saat ini."},{status:500});}
}
export async function POST(request:Request){
 const access=await requireApiPermission("accounts-manage");if(access.response)return access.response;
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
 const parsed=createSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Periksa kembali field yang wajib diisi.",fields:parsed.error.flatten().fieldErrors},{status:422});
 try{
  const data=parsed.data;
  const user=await db.$transaction(async tx=>{
   const created=await tx.user.create({data:{username:data.username,passwordHash:await argon2.hash(data.password,{type:argon2.argon2id}),role:data.role as Role,displayName:data.displayName,nrp:data.nrp||null,rank:data.rank||null,position:data.position||null},select:safeSelect});
   await writeAuditLog(tx,access.user!,{action:"ACCOUNT_CREATED",entityType:"ACCOUNT",entityId:created.id,metadata:{role:data.role}});
   return created;
  });
  return NextResponse.json({data:user},{status:201});
 }catch(error){
  if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002")return NextResponse.json({error:"Username sudah digunakan oleh akun lain."},{status:409});
  return NextResponse.json({error:"Akun tidak dapat disimpan. Coba kembali."},{status:500});
 }
}
