import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import argon2 from "argon2";

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error("DATABASE_URL is required to seed accounts.");
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString})});
type SeedAccount={role:Role;username?:string;password?:string;nrp?:string;rank?:string;position?:string};
const accounts:SeedAccount[]=[
 {role:"SUPER_ADMIN",username:process.env.SEED_SUPER_ADMIN_USERNAME,password:process.env.SEED_SUPER_ADMIN_PASSWORD},
 {role:"KOMANDAN",username:process.env.SEED_KOMANDAN_USERNAME,password:process.env.SEED_KOMANDAN_PASSWORD},
 {role:"PERSONEL",username:process.env.SEED_PERSONEL_USERNAME,password:process.env.SEED_PERSONEL_PASSWORD,nrp:process.env.SEED_PERSONEL_NRP,rank:process.env.SEED_PERSONEL_RANK,position:process.env.SEED_PERSONEL_POSITION},
 {role:"PERSIT",username:process.env.SEED_PERSIT_USERNAME,password:process.env.SEED_PERSIT_PASSWORD},
 {role:"PERSIT",username:process.env.SEED_PERSIT_PENDING_USERNAME,password:process.env.SEED_PERSIT_PENDING_PASSWORD}
];
async function main(){
 const configured=accounts.filter(a=>a.username||a.password);
 if(!configured.length)throw new Error("Configure at least one SEED_<ROLE>_USERNAME/PASSWORD pair.");
 for(const account of configured){
  if(!account.username||!account.password)throw new Error(`Incomplete seed credentials for ${account.role}`);
  if(account.password.length<12)throw new Error(`Seed password for ${account.role} must be at least 12 characters.`);
  const existing=await prisma.user.findUnique({where:{username:account.username}});
  if(existing&&existing.role!==account.role)throw new Error("Username is already assigned to another role.");
  const passwordHash=await argon2.hash(account.password,{type:argon2.argon2id});
  const profile={displayName:account.username,nrp:account.nrp||null,rank:account.rank||null,position:account.position||null};
  await prisma.user.upsert({where:{username:account.username},update:{passwordHash,role:account.role,...profile},create:{username:account.username,passwordHash,role:account.role,...profile}});
  console.log(`Seeded ${account.role}: ${account.username}`);
 }
 const linkedPersonnelUsername=process.env.SEED_PERSIT_LINKED_PERSONNEL_USERNAME;
 if(linkedPersonnelUsername){
  const persitUsername=process.env.SEED_PERSIT_USERNAME;
  if(!persitUsername)throw new Error("SEED_PERSIT_USERNAME is required when linking a seeded Persit.");
  const personnel=await prisma.user.findUnique({where:{username:linkedPersonnelUsername}});
  const persit=await prisma.user.findUnique({where:{username:persitUsername}});
  if(!personnel||personnel.role!=="PERSONEL"||!persit||persit.role!=="PERSIT")throw new Error("Seeded Persit link must reference an existing Personel and Persit account.");
  await prisma.user.update({where:{id:persit.id},data:{linkedPersonnelId:personnel.id,nrp:personnel.nrp}});
  console.log(`Linked seeded Persit ${persit.username} to Personel ${personnel.username}`);
 }
}
main().finally(async()=>prisma.$disconnect());
