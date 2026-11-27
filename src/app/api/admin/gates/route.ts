import { NextResponse } from "next/server";
import { createGateQrCredential } from "@/lib/gate-qr";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit-log";

const schema=z.object({
  name:z.string().trim().min(1,"Nama gate wajib diisi.").max(120),
  location:z.string().trim().min(1,"Lokasi gate wajib diisi.").max(240),
  status:z.enum(["AKTIF","NONAKTIF"]).default("AKTIF")
});
const select={id:true,name:true,location:true,status:true,createdAt:true,updatedAt:true} as const;

export async function GET(){
  const access=await requireApiPermission("gate-manage");
  if(access.response)return access.response;
  try{
    const data=await db.gate.findMany({select,orderBy:[{createdAt:"desc"},{name:"asc"}]});
    return NextResponse.json({data});
  }catch{
    return NextResponse.json({error:"Data gate tidak dapat dimuat."},{status:500});
  }
}

export async function POST(request:Request){
  const access=await requireApiPermission("gate-manage");
  if(access.response)return access.response;
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Format permintaan tidak valid."},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:"Periksa nama, lokasi, dan status gate.",fields:parsed.error.flatten().fieldErrors},{status:422});
  try{
    const credential=createGateQrCredential();
    const data=await db.$transaction(async tx=>{const created=await tx.gate.create({data:{...parsed.data,qrTokenHash:credential.tokenHash},select});await writeAuditLog(tx,access.user!,{action:"GATE_CREATED",entityType:"GATE",entityId:created.id,metadata:{name:created.name,status:created.status}});return created;});
    return NextResponse.json({data,qrCredential:credential.token},{status:201});
  }catch{
    return NextResponse.json({error:"Gate gagal disimpan."},{status:500});
  }
}
