import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
export async function requireApiPermission(permission:string){
 const user=await getCurrentUser();
 if(!user)return {user:null,response:NextResponse.json({error:"Sesi tidak ditemukan. Silakan login kembali."},{status:401})};
 if(user.mustChangePassword)return {user:null,response:NextResponse.json({error:"Ubah password terlebih dahulu sebelum melanjutkan."},{status:403})};
 if(!canAccess(user.role,permission))return {user:null,response:NextResponse.json({error:"Anda tidak memiliki hak akses untuk tindakan ini."},{status:403})};
 return {user,response:null};
}
