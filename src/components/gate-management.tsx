"use client";

import { FormEvent,useCallback,useEffect,useState } from "react";
import { GateQrCredential } from "@/components/gate-qr-credential";

type Gate={id:string;name:string;location:string;status:"AKTIF"|"NONAKTIF";createdAt:string;updatedAt:string};
type GateForm={name:string;location:string;status:"AKTIF"|"NONAKTIF"};
const blank:GateForm={name:"",location:"",status:"AKTIF"};

export function GateManagement(){
  const [rows,setRows]=useState<Gate[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [form,setForm]=useState<GateForm>(blank);
  const [editing,setEditing]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [createdCredential,setCreatedCredential]=useState("");
  const [createdGateName,setCreatedGateName]=useState("");

  const fetchRows=useCallback(async():Promise<Gate[]>=>{
    const response=await fetch("/api/edge/gates",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error??"Data gate gagal dimuat.");
    return data.data as Gate[];
  },[]);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await fetchRows());}
    catch(e){setError(e instanceof TypeError?"Koneksi ke server terputus. Periksa jaringan lalu coba lagi.":e instanceof Error?e.message:"Server tidak dapat memuat data gate.");}
    finally{setLoading(false);}
  },[fetchRows]);

  useEffect(()=>{
    let active=true;
    void fetchRows().then(data=>{if(active)setRows(data);})
      .catch(e=>{if(active)setError(e instanceof TypeError?"Koneksi ke server terputus. Periksa jaringan lalu coba lagi.":e instanceof Error?e.message:"Server tidak dapat memuat data gate.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[fetchRows]);

  function create(){setForm(blank);setEditing(null);setError("");setNotice("");setCreatedCredential("");setCreatedGateName("");setShowForm(true);}
  function edit(gate:Gate){setForm({name:gate.name,location:gate.location,status:gate.status});setEditing(gate.id);setError("");setNotice("");setCreatedCredential("");setCreatedGateName("");setShowForm(true);}

  async function submit(event:FormEvent){
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch(editing?"/api/edge/gates/"+editing:"/api/edge/gates",{
        method:editing?"PATCH":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form)
      });
      const result=await response.json();
      if(!response.ok){setError(result.error??"Gate gagal disimpan.");return;}
      setShowForm(false);
      setCreatedCredential(!editing && typeof result.qrCredential === "string" ? result.qrCredential : "");
      setCreatedGateName(!editing && typeof result.data?.name === "string" ? result.data.name : "Gate");
      setNotice(editing?"Perubahan gate berhasil disimpan.":"Gate berhasil dibuat. Simpan kredensial QR yang ditampilkan satu kali.");
      await load();
    }catch(e){
      setError(e instanceof TypeError?"Koneksi ke server terputus. Data belum tersimpan.":"Server tidak dapat menyimpan gate. Coba kembali.");
    }finally{setSaving(false);}
  }

  return <section className="admin-page">
    <div className="admin-heading">
      <div><p className="eyebrow">KONFIGURASI LOKASI</p><h1>Pengelolaan Gate</h1><p className="muted">Kelola nama, lokasi, dan status gate operasional. Gate nonaktif tidak dapat digunakan untuk transaksi.</p></div>
      <button className="primary-button" onClick={create}>Tambah gate</button>
    </div>
    {notice&&<p className="success-message" role="status">{notice}</p>}
    {createdCredential&&<GateQrCredential credential={createdCredential} gateName={createdGateName}/>}
    {error&&<div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={()=>void load()}>Coba lagi</button></div>}
    {showForm&&<div className="modal-backdrop">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="gate-form-title">
        <div className="modal-title"><div><p className="eyebrow">{editing?"UBAH DATA":"DATA BARU"}</p><h2 id="gate-form-title">{editing?"Edit gate":"Tambah gate"}</h2></div><button className="icon-button" onClick={()=>setShowForm(false)} aria-label="Tutup">×</button></div>
        <form className="gate-form" onSubmit={submit}>
          <label className="wide">Nama gate<input required minLength={1} maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoFocus/></label>
          <label className="wide">Lokasi gate<input required minLength={1} maxLength={240} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
          <label className="wide">Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as GateForm["status"]})}><option value="AKTIF">AKTIF</option><option value="NONAKTIF">NONAKTIF</option></select></label>
          {error&&<p className="form-error wide" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving}>{saving?"Menyimpan...":"Simpan gate"}</button></div>
        </form>
      </section>
    </div>}
    <div className="table-card">
      <div className="table-toolbar"><div><h2>Daftar gate</h2><p>{rows.length} gate terdaftar</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}>Muat ulang</button></div>
      {loading?<div className="table-state" role="status">Memuat data gate...</div>:rows.length===0&&!error?<div className="table-state"><strong>Belum ada gate</strong><p>Tambahkan gate untuk mulai menyiapkan lokasi transaksi.</p></div>:rows.length>0&&<div className="table-scroll"><table><thead><tr><th>Nama gate</th><th>Lokasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(gate=><tr key={gate.id}><td>{gate.name}</td><td>{gate.location}</td><td><span className={"gate-status "+(gate.status==="AKTIF"?"active":"inactive")}>{gate.status}</span></td><td><button className="text-action" onClick={()=>edit(gate)}>Edit</button></td></tr>)}</tbody></table></div>}
    </div>
    <p className="muted">QR ditampilkan satu kali setelah Gate baru dibuat. Gate lama belum memiliki kredensial; regenerasi belum tersedia.</p>
  </section>;
}
