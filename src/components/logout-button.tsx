"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export function LogoutButton() {
 const router=useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState("");
 async function logout(){setPending(true);setError("");try{const response=await fetch("/api/auth/logout",{method:"POST"});if(!response.ok)throw new Error();router.replace("/login");router.refresh();}catch{setError("Tidak dapat keluar. Coba kembali.");setPending(false);}}
 return <div><button className="logout-button" onClick={logout} disabled={pending}><LogOut size={16}/>{pending?"Keluar...":"Keluar"}</button>{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
