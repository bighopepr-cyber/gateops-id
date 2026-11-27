"use client";
import { useCallback,useEffect,useState } from "react";
type Candidate={id:string;nrp:string|null;displayName:string;rank:string|null;position:string|null;alreadyLinked:boolean};
type RequestRow={id:string;username:string;displayName:string;nrp:string|null;createdAt:string;candidates:Candidate[]};

export function PersitVerification(){
 const [rows,setRows]=useState<RequestRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [selected,setSelected]=useState<Record<string,string>>({});
 const [saving,setSaving]=useState<string|null>(null);

 const fetchRows=useCallback(async():Promise<RequestRow[]>=>{
  const response=await fetch("/api/admin/persit-verification",{cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error??"Daftar verifikasi gagal dimuat.");
  return result.data as RequestRow[];
 },[]);

 const applyRows=useCallback((data:RequestRow[])=>{
  setRows(data);
  setSelected(current=>{
   const next={...current};
   for(const row of data){
    if(!row.candidates.some(candidate=>candidate.id===next[row.id]&&!candidate.alreadyLinked)){
     const eligible=row.candidates.filter(candidate=>!candidate.alreadyLinked);
     next[row.id]=eligible.length===1?eligible[0].id:"";
    }
   }
   return next;
  });
 },[]);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{applyRows(await fetchRows());}
  catch(e){setError(e instanceof TypeError?"Koneksi ke server terputus. Periksa jaringan lalu coba lagi.":e instanceof Error?e.message:"Server tidak dapat memuat permintaan.");}
  finally{setLoading(false);}
 },[applyRows,fetchRows]);

 useEffect(()=>{
  let active=true;
  void fetchRows().then(data=>{if(active)applyRows(data);})
   .catch(e=>{if(active)setError(e instanceof TypeError?"Koneksi ke server terputus. Periksa jaringan lalu coba lagi.":e instanceof Error?e.message:"Server tidak dapat memuat permintaan.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[applyRows,fetchRows]);

 async function verify(row:RequestRow){
  const personnelId=selected[row.id];if(!personnelId)return;
  setSaving(row.id);setError("");setNotice("");
  try{
   const response=await fetch("/api/admin/persit-verification/"+row.id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personnelId})});
   const result=await response.json();
   if(!response.ok){setError(result.error??"Verifikasi gagal.");return;}
   setNotice("Akun Persit "+row.username+" berhasil dihubungkan dengan personel.");
   await load();
  }catch(e){setError(e instanceof TypeError?"Koneksi terputus. Status verifikasi belum dapat dipastikan; muat ulang daftar.":"Server tidak dapat menyimpan verifikasi.");}
  finally{setSaving(null);}
 }

 return <section className="admin-page">
  <div className="admin-heading"><div><p className="eyebrow">PENGELOLAAN PERSIT</p><h1>Verifikasi Persit</h1><p className="muted">Tinjau permintaan dan hubungkan akun hanya dengan personel yang NRP-nya cocok.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}>Muat ulang</button></div>
  {notice&&<p className="success-message" role="status">{notice}</p>}
  {error&&<div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={()=>void load()}>Coba lagi</button></div>}
  <div className="table-card">
   <div className="table-toolbar"><div><h2>Permintaan pengaitan</h2><p>{rows.length} permintaan menunggu verifikasi</p></div></div>
   {loading?<div className="table-state" role="status">Memuat permintaan verifikasi...</div>:rows.length===0?<div className="table-state"><strong>Tidak ada permintaan tertunda</strong><p>Permintaan registrasi Persit yang belum terhubung akan muncul di sini.</p></div>:<div className="verification-list">
    {rows.map(row=><article className="verification-card" key={row.id}>
     <div className="verification-person"><span className="eyebrow">AKUN PERSIT</span><h3>{row.displayName}</h3><p>Username: <strong>{row.username}</strong></p><p>NRP diajukan: <strong>{row.nrp||"—"}</strong></p><p className="muted">Didaftarkan {new Date(row.createdAt).toLocaleString("id-ID")}</p></div>
     <div className="verification-action">
      {row.candidates.length===0?<><p className="muted">Belum ada data Personel dengan NRP yang cocok. Permintaan tetap menunggu verifikasi.</p><button className="primary-button" disabled>Tidak tersedia kandidat</button></>:row.candidates.every(candidate=>candidate.alreadyLinked)?<><p className="muted">NRP ini sudah memiliki akun Persit terhubung. Kebijakan untuk pengaitan tambahan masih menunggu keputusan Owner.</p><button className="primary-button" disabled>Menunggu keputusan Owner</button></>:<><label htmlFor={"candidate-"+row.id}>Personel yang cocok</label><select id={"candidate-"+row.id} value={selected[row.id]??""} onChange={e=>setSelected({...selected,[row.id]:e.target.value})}><option value="">Pilih personel</option>{row.candidates.map(candidate=><option key={candidate.id} value={candidate.id} disabled={candidate.alreadyLinked}>{candidate.displayName} · {candidate.rank??"—"} · {candidate.position??"—"}{candidate.alreadyLinked?" · sudah terhubung":""}</option>)}</select><button className="primary-button" disabled={!selected[row.id]||saving===row.id} onClick={()=>void verify(row)}>{saving===row.id?"Memverifikasi...":"Verifikasi dan hubungkan"}</button></>}
     </div>
    </article>)}
   </div>}
  </div>
 </section>;
}
