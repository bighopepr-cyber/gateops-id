"use client";
import Link from "next/link";
import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export default function PersitRegistrationPage(){
 const router=useRouter();
 const [form,setForm]=useState({nrp:"",displayName:"",username:"",password:""});
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");setLoading(true);
  try{
   const response=await fetch("/api/auth/register/persit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){setError(result.error??"Registrasi gagal. Periksa kembali data Anda.");return;}
   router.replace("/register/persit/success");
  }catch{setError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba kembali.");}
  finally{setLoading(false);}
 }
 return <main className="login-shell"><section className="login-card registration-card" aria-labelledby="register-title"><div className="brand-mark"><ShieldCheck size={25}/></div><p className="eyebrow">AKUN KELUARGA</p><h1 id="register-title">Registrasi Persit</h1><p className="muted login-description">Buat akun dan ajukan pengaitan menggunakan NRP personel. Pengaitan menunggu verifikasi Super Admin.</p><form onSubmit={submit} className="login-form"><label htmlFor="nrp">NRP personel</label><input id="nrp" name="nrp" value={form.nrp} onChange={e=>setForm({...form,nrp:e.target.value})} required maxLength={40}/><label htmlFor="displayName">Nama Persit</label><input id="displayName" name="displayName" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} required maxLength={160}/><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required maxLength={80}/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required maxLength={1024}/>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading?"Mengirim registrasi...":"Daftar dan ajukan pengaitan"}</button></form><p className="login-footnote">Sudah memiliki akun? <Link href="/login">Masuk</Link></p></section></main>;
}
