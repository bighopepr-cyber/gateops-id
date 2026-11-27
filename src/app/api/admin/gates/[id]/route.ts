import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";

const schema=z.object({
  name:z.string().trim().min(1,"Nama gate wajib diisi.").max(120),
  location:z.string().trim().min(1,"Lokasi gate wajib diisi.").max(240),
  status:z.enum(["AKTIF","NONAKTIF"])
});
type Context={params:Promise<{id:string}>};
const select={id:true,name:true,location:true,status:true,createdAt:true,updatedAt:true} as const;

export async function GET(_request:Request,{params}:Context){
  const access=await requireApiPermission("gate-manage");
  if(access.response)return access.response;
  const {id}=await params;
  try{
    const data=await db.gate.findUnique({where:{id},select});
    if(!data)return NextResponse.json({error:"Gate tidak ditemukan."},{status:404});
    return NextResponse.json({data});
  }catch{
    return NextResponse.json({error:"Detail gate tidak dapat dimuat."},{status:500});
  }
}

export async function PATCH(request:Request,{params}:Context){
  const access=await requireApiPermission("gate-manage");
  if(access.response)return access.response;
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:"Periksa nama, lokasi, dan status gate.",fields:parsed.error.flatten().fieldErrors},{status:422});
  const {id}=await params;
  try{
    const data=await db.$transaction(async tx=>{const updated=await tx.gate.update({where:{id},data:parsed.data,select});await writeAuditLog(tx,access.user!,{action:"GATE_UPDATED",entityType:"GATE",entityId:id,metadata:{name:updated.name,status:updated.status}});return updated;});
    return NextResponse.json({data});
  }catch(error){
    if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2025")return NextResponse.json({error:"Gate tidak ditemukan."},{status:404});
    return NextResponse.json({error:"Perubahan gate gagal disimpan."},{status:500});
  }
}
