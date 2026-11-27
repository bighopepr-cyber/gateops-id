import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

export async function GET(){
 const access=await requireApiPermission("persit-verify");if(access.response)return access.response;
 try{
  const requests=await db.user.findMany({where:{role:"PERSIT",linkedPersonnelId:null},select:{id:true,username:true,displayName:true,nrp:true,createdAt:true},orderBy:{createdAt:"asc"}});
  const data=await Promise.all(requests.map(async request=>({
   ...request,
   candidates:request.nrp?(await db.user.findMany({where:{role:"PERSONEL",nrp:request.nrp},select:{id:true,nrp:true,displayName:true,rank:true,position:true,_count:{select:{linkedPersitAccounts:true}}},orderBy:{displayName:"asc"}})).map(({_count,...candidate})=>({...candidate,alreadyLinked:_count.linkedPersitAccounts>0})):[]
  })));
  return NextResponse.json({data});
 }catch{return NextResponse.json({error:"Permintaan verifikasi tidak dapat dimuat."},{status:500});}
}
