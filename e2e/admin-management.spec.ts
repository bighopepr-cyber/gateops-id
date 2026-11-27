import { expect,test,type Page } from "@playwright/test";
import { Client } from "pg";

async function login(page:Page,username:string,password:string){
 await page.goto("/login");
 await page.getByLabel("Username").fill(username);
 await page.getByLabel("Password").fill(password);
 const loginResponsePromise=page.waitForResponse(response=>response.url().includes("/api/auth/login")&&response.request().method()==="POST");
 await page.getByRole("button",{name:"Masuk"}).click();
 const loginResponse=await loginResponsePromise;
 const loginBody=await loginResponse.json().catch(()=>({error:"Respons login bukan JSON."}));
 expect(loginResponse.ok(),`Login ${username} gagal (HTTP ${loginResponse.status()}): ${loginBody.error??"tanpa pesan error"}`).toBe(true);
}

test("command dashboard shows persisted personnel statistics, outside activity, and latest return transaction",async({page})=>{
 // CI has no hosted Supabase project; bridge the new dashboard BFF request to
 // the existing PostgreSQL-backed route so the browser assertion remains DB-backed.
 await page.route("**/api/edge/command-dashboard", async route=>{
  const legacyUrl=new URL("/api/dashboard/command",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const person=await page.request.post("/api/admin/personnel",{data:{
  nrp:"CI-COMMAND-NRP-001",displayName:"Personel Dashboard E2E",rank:"Kapten",position:"Pengujian Dashboard",
  username:"ci-personel-command-dashboard",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!
 }});
 expect(person.status()).toBe(201);
 const gate=await page.request.post("/api/admin/gates",{data:{name:"Gate Dashboard E2E",location:"Pos Dashboard",status:"AKTIF"}});
 expect(gate.status()).toBe(201);
 const credential=(await gate.json()).qrCredential as string;

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-personel-command-dashboard",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const exit=await page.evaluate(async token=>{
  const response=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas Dashboard",purpose:"Uji transaksi dashboard"})});
  return {status:response.status,body:await response.json()};
 },credential);
 expect(exit.status).toBe(200);
 const denied=await page.evaluate(async()=>{const response=await fetch("/api/dashboard/command");const edge=await fetch("/api/edge/command-dashboard");return {legacy:response.status,edge:edge.status};});
 expect(denied).toEqual({legacy:403,edge:403});

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const dbClient=new Client({connectionString:process.env.DATABASE_URL});
 await dbClient.connect();
 let expected:{total:number;inside:number;outside:number};
 try{
  const result=await dbClient.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE presence_status='DI_DALAM')::int AS inside, COUNT(*) FILTER (WHERE presence_status='DI_LUAR')::int AS outside FROM users WHERE role='PERSONEL'");
  expected={total:result.rows[0].total,inside:result.rows[0].inside,outside:result.rows[0].outside};
 }finally{await dbClient.end();}
 await expect(page.getByRole("heading",{name:"Dashboard Komando"})).toBeVisible();
 const stats=page.locator(".command-stat-card strong");
 await expect(stats.nth(0)).toHaveText(String(expected.total));
 await expect(stats.nth(1)).toHaveText(String(expected.inside));
 await expect(stats.nth(2)).toHaveText(String(expected.outside));
 const outsideRow=page.locator(".command-data-section").first().getByRole("row").filter({hasText:"Personel Dashboard E2E"});
 await expect(outsideRow).toBeVisible();
 await expect(outsideRow).toContainText("Gate Dashboard E2E");
 await expect(outsideRow).toContainText("Markas Dashboard");
 await expect(outsideRow).toContainText("Uji transaksi dashboard");
 const latestRow=page.locator(".command-data-section").nth(1).getByRole("row").filter({hasText:"Personel Dashboard E2E"});
 await expect(latestRow).toContainText("KELUAR");
 await expect(latestRow).toContainText("AKTIF");

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-personel-command-dashboard",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const returned=await page.evaluate(async token=>{
  const response=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token})});
  return response.status;
 },credential);
 expect(returned).toBe(200);

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.getByRole("button",{name:"Perbarui data"}).click();
 const refreshedRow=page.locator(".command-data-section").nth(1).getByRole("row").filter({hasText:"Personel Dashboard E2E"});
 await expect(refreshedRow).toContainText("KEMBALI");
 await expect(refreshedRow).toContainText("SELESAI");
 await expect(page.locator(".command-data-section").first().getByText("Tidak ada personel yang sedang DI LUAR.")).toBeVisible();
 // Stop the dashboard polling route before Playwright tears down the page; an
 // in-flight background refresh must not fail the test during context cleanup.
 await page.unrouteAll({behavior:"ignoreErrors"});
});


test("Super Admin creates personnel, persists it, and Komandan is read-only",async({page})=>{
 await page.route("**/api/edge/personnel", async route=>{
  const legacyUrl=new URL("/api/admin/personnel",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 await page.route("**/api/edge/accounts", async route=>{
  const legacyUrl=new URL("/api/admin/accounts",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const unauthenticated=await page.request.get("/api/edge/personnel");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/personnel");
 await page.getByRole("button",{name:"Tambah personel"}).click();
 await page.getByLabel("NRP").fill("CI-NRP-001");
 await page.getByLabel("Nama lengkap").fill("Personel Uji CI");
 await page.getByLabel("Pangkat").fill("Kapten");
 await page.getByLabel("Jabatan").fill("Penguji");
 await page.getByLabel("Username").fill("ci-personel-created");
 await page.getByLabel("Password awal").fill(process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await page.getByRole("button",{name:"Simpan",exact:true}).click();
 await expect(page.getByText("Personel dan akun login berhasil dibuat.")).toBeVisible();
 const personnelRow=page.getByRole("row",{name:/ci-personel-created/});
 await expect(personnelRow).toBeVisible();
 await personnelRow.getByRole("button",{name:"Edit"}).click();
 await page.getByLabel("Nama lengkap").fill("Personel Uji Diperbarui");
 await page.getByRole("button",{name:"Simpan",exact:true}).click();
 await expect(page.getByText("Perubahan personel berhasil disimpan.")).toBeVisible();
 await expect(page.getByRole("cell",{name:"Personel Uji Diperbarui"})).toBeVisible();
 await page.reload();
 await expect(page.getByRole("cell",{name:"Personel Uji Diperbarui"})).toBeVisible();
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/personnel");
 await expect(page.getByRole("cell",{name:"Personel Uji Diperbarui"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Tambah personel"})).toHaveCount(0);
 const denied=await page.request.post("/api/admin/personnel",{data:{nrp:"CI-NRP-002",displayName:"Tidak Boleh",rank:"Kapten",position:"Penguji",username:"ci-forbidden",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(denied.status()).toBe(403);
 await page.goto("/admin/accounts");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 await page.goto("/admin/persit-verification");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const deniedAccounts=await page.evaluate(async()=>{const response=await fetch("/api/edge/accounts");return response.status;});
 expect(deniedAccounts).toBe(403);
 await page.unrouteAll({behavior:"ignoreErrors"});
});

test("Super Admin creates account, resets password, and user is forced to change it",async({page})=>{
 await page.route("**/api/edge/accounts", async route=>{
  const legacyUrl=new URL("/api/admin/accounts",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const unauthenticated=await page.request.get("/api/edge/accounts");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/accounts");
 await page.getByRole("button",{name:"Tambah akun"}).click();
 await page.getByLabel("Role").selectOption("KOMANDAN");
 await page.getByLabel("Nama").fill("Komandan Uji CI");
 await page.getByLabel("NRP").fill("CI-KOM-001");
 await page.getByLabel("Pangkat").fill("Mayor");
 await page.getByLabel("Jabatan").fill("Komandan Pengujian");
 await page.getByLabel("Username").fill("ci-komandan-created");
 await page.getByLabel("Password awal").fill(process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await page.getByRole("button",{name:"Simpan akun"}).click();
 let row=page.getByRole("row",{name:/ci-komandan-created/});
 await expect(row).toBeVisible();
 await row.getByRole("button",{name:"Edit"}).click();
 await page.getByLabel("Nama").fill("Komandan Uji Diperbarui");
 await page.getByRole("button",{name:"Simpan akun"}).click();
 await expect(page.getByText("Perubahan akun berhasil disimpan.")).toBeVisible();
 await expect(page.getByRole("cell",{name:"Komandan Uji Diperbarui"})).toBeVisible();
 row=page.getByRole("row",{name:/ci-komandan-created/});
 await row.getByRole("button",{name:"Reset password"}).click();
 await expect(page.getByRole("alertdialog")).toBeVisible();
 await page.getByRole("button",{name:"Ya, reset password"}).click();
 await expect(page.getByText("Password sementara berhasil dibuat")).toBeVisible();
 const temporaryPassword=await page.locator(".temporary-panel code").innerText();
 expect(temporaryPassword.length).toBeGreaterThan(10);
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-komandan-created",temporaryPassword);
 await expect(page).toHaveURL(/\/change-password$/);
 await page.getByLabel("Password baru",{exact:true}).fill(process.env.E2E_FINAL_PASSWORD!);
 await page.getByLabel("Konfirmasi password baru").fill(process.env.E2E_FINAL_PASSWORD!);
 await page.getByRole("button",{name:"Simpan password"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await expect(page.getByRole("heading",{name:/Selamat datang, Komandan Uji Diperbarui/})).toBeVisible();
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const audit=await page.evaluate(async()=>{
  const [accountsResponse,logsResponse]=await Promise.all([fetch("/api/edge/accounts"),fetch("/api/admin/audit-logs?page=1&pageSize=100")]);
  return {accounts:await accountsResponse.json(),logs:await logsResponse.json(),status:logsResponse.status};
 });
 expect(audit.status).toBe(200);
 const accountId=(audit.accounts.data as Array<{id:string;username:string}>).find(row=>row.username==="ci-komandan-created")?.id;
 expect(accountId).toBeTruthy();
 const events=(audit.logs.data as Array<{entityId:string;action:string}>).filter(row=>row.entityId===accountId);
 expect(events.map(row=>row.action)).toEqual(expect.arrayContaining(["ACCOUNT_CREATED","ACCOUNT_UPDATED","ACCOUNT_PASSWORD_RESET","ACCOUNT_PASSWORD_CHANGED"]));
 await page.unrouteAll({behavior:"ignoreErrors"});
});

test("admin APIs reject unauthenticated requests",async({request})=>{
 const accounts=await request.get("/api/admin/accounts");
 const personnel=await request.get("/api/admin/personnel");
 expect(accounts.status()).toBe(401);
 expect(personnel.status()).toBe(401);
});

test("audit log records account lifecycle events and is readable only by Super Admin",async({page})=>{
 await page.route("**/api/edge/audit-logs*", async route=>{
  const incoming=new URL(route.request().url());
  const legacyUrl=new URL("/api/admin/audit-logs"+incoming.search,incoming).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const unauthenticated=await page.request.get("/api/edge/audit-logs");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");

 const created=await page.evaluate(async password=>{
  const response=await fetch("/api/admin/accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   username:"ci-audit-account",password,role:"KOMANDAN",displayName:"Akun Audit CI",nrp:"CI-AUDIT-001",rank:"Mayor",position:"Pengujian Audit"
  })});
  return {status:response.status,body:await response.json()};
 },process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 expect(created.status).toBe(201);
 const accountId=created.body.data.id as string;

 const updated=await page.evaluate(async id=>{
  const response=await fetch("/api/admin/accounts/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName:"Akun Audit Diperbarui"})});
  return response.status;
 },accountId);
 expect(updated).toBe(200);

 const reset=await page.evaluate(async id=>{
  const response=await fetch("/api/admin/accounts/"+id+"/reset-password",{method:"POST"});
  return response.status;
 },accountId);
 expect(reset).toBe(200);

 const audit=await page.evaluate(async()=>{
  const response=await fetch("/api/edge/audit-logs?page=1&pageSize=100");
  return {status:response.status,body:await response.json()};
 });
 expect(audit.status).toBe(200);
 const events=(audit.body.data as Array<{entityId:string;action:string;metadata:Record<string,unknown>}>).filter(row=>row.entityId===accountId);
 expect(events.map(row=>row.action)).toEqual(expect.arrayContaining(["ACCOUNT_CREATED","ACCOUNT_UPDATED","ACCOUNT_PASSWORD_RESET"]));
 expect(JSON.stringify(events.map(row=>row.metadata))).not.toMatch(/password|token|secret|credential|hash/i);

 await page.goto("/admin/audit-logs");
 await expect(page.getByRole("heading",{name:"Audit Log"})).toBeVisible();
 await expect(page.locator("tbody tr").filter({hasText:"ACCOUNT_PASSWORD_RESET"}).first()).toBeVisible();

 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const denied=await page.evaluate(async()=>{
  const response=await fetch("/api/edge/audit-logs");
  return response.status;
 });
 expect(denied).toBe(403);
 await page.goto("/admin/audit-logs");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-persit",process.env.SEED_PERSIT_PASSWORD!);
 const persitDenied=await page.evaluate(async()=>{const response=await fetch("/api/edge/audit-logs");return response.status;});
 expect(persitDenied).toBe(403);
 await page.unrouteAll({behavior:"ignoreErrors"});
});


test("Personel and Persit cannot access admin management routes",async({page})=>{
 await page.route("**/api/edge/personnel", async route=>{
  const response=await route.fetch({url:new URL("/api/admin/personnel",route.request().url()).toString()});
  await route.fulfill({response});
 });
 await page.route("**/api/edge/accounts", async route=>{
  const response=await route.fetch({url:new URL("/api/admin/accounts",route.request().url()).toString()});
  await route.fulfill({response});
 });
 await login(page,"ci-personel",process.env.SEED_PERSONEL_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/personnel");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 await page.goto("/admin/accounts");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const personelApi=await page.evaluate(async()=>{const response=await fetch("/api/edge/personnel");return response.status;});
 expect(personelApi).toBe(403);
 const personelAccounts=await page.evaluate(async()=>{const response=await fetch("/api/edge/accounts");return response.status;});
 expect(personelAccounts).toBe(403);
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-persit",process.env.SEED_PERSIT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/personnel");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 await page.goto("/admin/accounts");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const persitApi=await page.evaluate(async()=>{const response=await fetch("/api/edge/personnel");return response.status;});
 expect(persitApi).toBe(403);
 const persitAccounts=await page.evaluate(async()=>{const response=await fetch("/api/edge/accounts");return response.status;});
 expect(persitAccounts).toBe(403);
 await page.unrouteAll({behavior:"ignoreErrors"});
});



test("personnel and account management expose loading, empty, network and server error states",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");

 await page.goto("/admin/personnel");
 await expect(page).toHaveURL(url=>url.pathname==="/admin/personnel");
 await expect(page.getByRole("heading",{name:"Data Personel"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Muat ulang"})).toBeVisible();
 await page.route("**/api/edge/personnel",async route=>{
  await new Promise(resolve=>setTimeout(resolve,1200));
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})});
 });
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.getByText("Memuat data personel...")).toBeVisible();
 await expect(page.getByText("Belum ada data personel")).toBeVisible();
 await page.unroute("**/api/edge/personnel");

 await page.route("**/api/edge/personnel",route=>route.abort());
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Koneksi ke server terputus.");
 await page.unroute("**/api/edge/personnel");

 await page.route("**/api/edge/personnel",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Layanan personel sedang tidak tersedia."})}));
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".form-error[role='alert']")).toContainText("Layanan personel sedang tidak tersedia.");
 await page.unroute("**/api/edge/personnel");

 await page.goto("/admin/accounts");
 await expect(page.getByRole("button",{name:"Muat ulang"}).first()).toBeVisible();
 await page.route("**/api/edge/accounts",async route=>{
  await new Promise(resolve=>setTimeout(resolve,1200));
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})});
 });
 await page.getByRole("button",{name:"Muat ulang"}).first().click();
 await expect(page.getByText("Memuat akun...")).toBeVisible();
 await expect(page.getByText("Belum ada akun")).toBeVisible();
 await page.unroute("**/api/edge/accounts");

 await page.route("**/api/edge/accounts",route=>route.abort());
 await page.getByRole("button",{name:"Muat ulang"}).first().click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Koneksi ke server terputus.");
 await page.unroute("**/api/edge/accounts");

 await page.route("**/api/edge/accounts",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Layanan akun sedang tidak tersedia."})}));
 await page.getByRole("button",{name:"Muat ulang"}).first().click();
 await expect(page.locator(".form-error[role='alert']")).toContainText("Layanan akun sedang tidak tersedia.");
 await page.unroute("**/api/edge/accounts");
});


test("Super Admin creates and edits persistent gates; other roles are denied",async({page})=>{
 // CI does not connect to a hosted Supabase project. Keep browser assertions DB-backed
 // by bridging the new Edge BFF paths to the legacy PostgreSQL-backed handlers.
 await page.route("**/api/edge/gates",async route=>{
  const request=route.request();
  const response=await route.fetch({url:new URL("/api/admin/gates",request.url()).toString(),method:request.method(),postData:request.postData()??undefined});
  await route.fulfill({response});
 });
 await page.route("**/api/edge/gates/*",async route=>{
  const request=route.request();
  const id=new URL(request.url()).pathname.split("/").pop();
  const response=await route.fetch({url:new URL("/api/admin/gates/"+id,request.url()).toString(),method:request.method(),postData:request.postData()??undefined});
  await route.fulfill({response});
 });
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await expect(page.getByRole("link",{name:/Pengelolaan Gate/})).toBeVisible();
 await page.goto("/admin/gates");
 await expect(page.getByRole("heading",{name:"Pengelolaan Gate"})).toBeVisible();
 await page.getByRole("button",{name:"Tambah gate"}).click();
 await page.getByLabel("Nama gate").fill("Gate Uji E2E");
 await page.getByLabel("Lokasi gate").fill("Gerbang Utama");
 await page.getByLabel("Status").selectOption("AKTIF");
 await page.getByRole("button",{name:"Simpan gate"}).click();
 await expect(page.getByText(/Gate berhasil dibuat/)).toBeVisible();
 await expect(page.getByRole("heading",{name:"QR Code Gate Uji E2E"})).toBeVisible();
 await expect(page.locator(".qr-credential-card code")).toHaveText(/^[A-Za-z0-9_-]{43}$/);
 const qrImage=page.locator(".qr-symbol-wrap img");
 await expect(qrImage).toHaveAttribute("alt","QR Code Gate Uji E2E");
 const qrSource=await qrImage.getAttribute("src");
 expect(qrSource).toContain("data:image/svg+xml;charset=utf-8,");
 expect(decodeURIComponent(qrSource!.split(",")[1])).toContain("<svg");
 const qrDownloadPromise=page.waitForEvent("download");
 await page.getByRole("button",{name:"Unduh QR (SVG)"}).click();
 const qrDownload=await qrDownloadPromise;
 expect(qrDownload.suggestedFilename()).toBe("gate-gate-uji-e2e-qr.svg");
 await page.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printCalled="true";};});
 await page.getByRole("button",{name:"Cetak QR"}).click();
 await expect(page.locator("html")).toHaveAttribute("data-print-called","true");
 const row=page.getByRole("row").filter({has:page.getByRole("cell",{name:"Gate Uji E2E",exact:true})});
 await expect(row).toBeVisible();
 await expect(row.getByText("AKTIF")).toBeVisible();
 await row.getByRole("button",{name:"Edit"}).click();
 await page.getByLabel("Nama gate").fill("Gate Uji Diperbarui");
 await page.getByLabel("Lokasi gate").fill("Gerbang Samping");
 await page.getByLabel("Status").selectOption("NONAKTIF");
 await page.getByRole("button",{name:"Simpan gate"}).click();
 await expect(page.getByText("Perubahan gate berhasil disimpan.")).toBeVisible();
 await expect(page.getByRole("cell",{name:"Gate Uji Diperbarui"})).toBeVisible();
 const updatedRow=page.getByRole("row").filter({has:page.getByRole("cell",{name:"Gate Uji Diperbarui",exact:true})});
 await expect(updatedRow.getByText("NONAKTIF")).toBeVisible();
 await page.reload();
 await expect(page.getByRole("cell",{name:"Gate Uji Diperbarui"})).toBeVisible();
 const persisted=await page.request.get("/api/admin/gates");
 expect(persisted.status()).toBe(200);
 const body=await persisted.json();
 expect(body.data).toEqual(expect.arrayContaining([expect.objectContaining({name:"Gate Uji Diperbarui",location:"Gerbang Samping",status:"NONAKTIF"})]));
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/gates");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const denied=await page.request.get("/api/admin/gates");
 expect(denied.status()).toBe(403);
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel",process.env.SEED_PERSONEL_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/gates");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 expect((await page.request.get("/api/admin/gates")).status()).toBe(403);
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-persit",process.env.SEED_PERSIT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/gates");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 expect((await page.request.get("/api/admin/gates")).status()).toBe(403);
});




test("Persit can self-register, wait for approval, and see only linked personnel identity and presence",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const created=await page.request.post("/api/admin/personnel",{data:{nrp:"CI-PERSIT-LINK-001",displayName:"Personel Uji Persit",rank:"Kapten",position:"Penguji Persit",username:"ci-personel-persit-link",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(created.status()).toBe(201);
 await page.getByRole("button",{name:"Keluar"}).click();
 await page.goto("/register/persit");
 await page.getByLabel("NRP personel").fill("CI-PERSIT-LINK-001");
 await page.getByLabel("Nama Persit").fill("Persit Uji Mandiri");
 await page.getByLabel("Username").fill("ci-persit-self-service");
 await page.getByLabel("Password").fill(process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await page.getByRole("button",{name:"Daftar dan ajukan pengaitan"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/register/persit/success");
 await expect(page.getByRole("heading",{name:"Permintaan tercatat"})).toBeVisible();
 await login(page,"ci-persit-self-service",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await expect(page.getByRole("heading",{name:"Menunggu verifikasi"})).toBeVisible();
 await expect(page.getByText("Personel Uji Persit")).toHaveCount(0);
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/persit-verification");
 const requestRow=page.locator(".verification-card").filter({hasText:"ci-persit-self-service"});
 await expect(requestRow).toBeVisible();
 const createdData=await created.json();
 const personnelResponse=await page.request.get("/api/admin/personnel");
 const personnelData=await personnelResponse.json();
 const wrongPersonnel=personnelData.data.find((person:{id:string})=>person.id!==createdData.data.id);
 expect(wrongPersonnel).toBeTruthy();
 const queueResponse=await page.request.get("/api/admin/persit-verification");
 const queueData=await queueResponse.json();
 const persitRequest=queueData.data.find((row:{username:string})=>row.username==="ci-persit-self-service");
 expect(persitRequest).toBeTruthy();
 const mismatched=await page.request.post("/api/admin/persit-verification/"+persitRequest.id,{data:{personnelId:wrongPersonnel.id}});
 expect(mismatched.status()).toBe(422);
 await requestRow.getByLabel("Personel yang cocok").selectOption({label:"Personel Uji Persit · Kapten · Penguji Persit"});
 await requestRow.getByRole("button",{name:"Verifikasi dan hubungkan"}).click();
 await expect(page.locator(".success-message")).toContainText("berhasil dihubungkan");
 await expect(requestRow).toHaveCount(0);
 const secondRegistration=await page.request.post("/api/auth/register/persit",{data:{nrp:"CI-PERSIT-LINK-001",displayName:"Persit Kedua",username:"ci-persit-self-service-duplicate",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(secondRegistration.status()).toBe(201);
 const secondQueue=await page.request.get("/api/admin/persit-verification");
 const secondQueueData=await secondQueue.json();
 const secondRequest=secondQueueData.data.find((row:{username:string})=>row.username==="ci-persit-self-service-duplicate");
 expect(secondRequest.candidates[0].alreadyLinked).toBe(true);
 const duplicateLink=await page.request.post("/api/admin/persit-verification/"+secondRequest.id,{data:{personnelId:createdData.data.id}});
 expect(duplicateLink.status()).toBe(409);
 await page.reload();
 const secondRow=page.locator(".verification-card").filter({hasText:"ci-persit-self-service-duplicate"});
 await expect(secondRow).toContainText("Menunggu keputusan Owner");
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-persit-self-service",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await expect(page.getByRole("heading",{name:"Personel Uji Persit"})).toBeVisible();
 await expect(page.getByText("CI-PERSIT-LINK-001")).toBeVisible();
 await expect(page.getByText("DI DALAM")).toBeVisible();
 await expect(page.getByText(/GPS|Lokasi terakhir|Tujuan|Keperluan|Riwayat aktivitas|Waktu keluar|Waktu kembali/i)).toHaveCount(0);
 await page.goto("/admin/persit-verification");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const denied=await page.request.get("/api/admin/persit-verification");
 expect(denied.status()).toBe(403);
});

test("Persit registration validates input and preserves global username uniqueness",async({request})=>{
 const invalid=await request.post("/api/auth/register/persit",{data:{nrp:"",displayName:"",username:"",password:""}});
 expect(invalid.status()).toBe(422);
 const duplicate=await request.post("/api/auth/register/persit",{data:{nrp:"CI-DUP-001",displayName:"Persit Duplicate",username:"ci-admin",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(duplicate.status()).toBe(409);
 const unauthorized=await request.get("/api/admin/persit-verification");
 expect(unauthorized.status()).toBe(401);
});



test("Persit verification handles empty, loading, network and server error states",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/persit-verification");
 await page.route("**/api/admin/persit-verification",async route=>{
  await new Promise(resolve=>setTimeout(resolve,900));
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})});
 });
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.getByText("Memuat permintaan verifikasi...")).toBeVisible();
 await expect(page.getByText("Tidak ada permintaan tertunda")).toBeVisible();
 await page.unroute("**/api/admin/persit-verification");
 await page.route("**/api/admin/persit-verification",route=>route.abort());
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Koneksi ke server terputus.");
 await page.unroute("**/api/admin/persit-verification");
 await page.route("**/api/admin/persit-verification",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Layanan verifikasi tidak tersedia."})}));
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Layanan verifikasi tidak tersedia.");
});

test("Super Admin permanently deletes personnel and only verified linked Persit accounts",async({page,browser})=>{
 await page.route("**/api/edge/personnel", async route=>{
  const legacyUrl=new URL("/api/admin/personnel",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const personnelContext=await browser.newContext({baseURL:"http://localhost:3000"});
 const persitContext=await browser.newContext({baseURL:"http://localhost:3000"});
 const komandanContext=await browser.newContext({baseURL:"http://localhost:3000"});
 const personnelPage=await personnelContext.newPage();
 const persitPage=await persitContext.newPage();
 const komandanPage=await komandanContext.newPage();
 try{
  await login(personnelPage,"ci-personel",process.env.SEED_PERSONEL_PASSWORD!);
  await expect(personnelPage).toHaveURL(url=>url.pathname==="/dashboard");
  await login(persitPage,"ci-persit",process.env.SEED_PERSIT_PASSWORD!);
  await expect(persitPage).toHaveURL(url=>url.pathname==="/dashboard");
  await login(komandanPage,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
  await expect(komandanPage).toHaveURL(url=>url.pathname==="/dashboard");
  await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await page.goto("/admin/personnel");
  const listResponse=await page.evaluate(async()=>{const response=await fetch("/api/admin/personnel");return {status:response.status,body:await response.json()};});
  expect(listResponse.status).toBe(200);
  const list=listResponse.body;
  const target=list.data.find((item:{username:string;id:string})=>item.username==="ci-personel");
  expect(target).toBeTruthy();
  const personnelId=target.id;
  const row=page.getByRole("row").filter({has:page.getByRole("cell",{name:"ci-personel",exact:true})});
  await expect(row).toBeVisible();

  await row.getByRole("button",{name:"Hapus"}).click();
  const dialog=page.getByRole("alertdialog");
  await expect(dialog).toContainText("akun Persit");
  await expect(dialog).toContainText("sesi login terkait");
  await dialog.getByRole("button",{name:"Batal"}).click();
  await expect(row).toBeVisible();

  await row.getByRole("button",{name:"Hapus"}).click();
  await page.route("**/api/admin/personnel/"+personnelId,route=>route.abort());
  await page.getByRole("button",{name:"Ya, hapus permanen"}).click();
  await expect(dialog.locator(".form-error[role='alert']")).toContainText("Penghapusan belum dapat dipastikan");
  await expect(dialog).toBeVisible();
  await page.unroute("**/api/admin/personnel/"+personnelId);

  await page.route("**/api/admin/personnel/"+personnelId,route=>route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({error:"Server gagal menghapus personel."})}));
  await page.getByRole("button",{name:"Ya, hapus permanen"}).click();
  await expect(dialog.locator(".form-error[role='alert']")).toContainText("Server gagal menghapus personel.");
  await expect(dialog).toBeVisible();
  await page.unroute("**/api/admin/personnel/"+personnelId);

  await page.getByRole("button",{name:"Ya, hapus permanen"}).click();
  await expect(page.locator(".success-message")).toContainText("1 akun Persit terhubung berhasil dihapus");
  await expect(page.getByRole("row",{name:"CI-PERSONEL-001 ci-personel"})).toHaveCount(0);

  const accounts=await page.evaluate(async()=>{const response=await fetch("/api/admin/accounts");return response.json();});
  const usernames=(accounts.data as Array<{username:string}>).map(account=>account.username);
  expect(usernames).not.toContain("ci-personel");
  expect(usernames).not.toContain("ci-persit");
  expect(usernames).toContain("ci-persit-pending");
  const deletedDetail=await page.request.get("/api/admin/personnel/"+personnelId);
  expect(deletedDetail.status()).toBe(404);

  await personnelPage.goto("/dashboard");
  await expect(personnelPage).toHaveURL(url=>url.pathname==="/login");
  await persitPage.goto("/dashboard");
  await expect(persitPage).toHaveURL(url=>url.pathname==="/login");
  const forbiddenStatus=await komandanPage.evaluate(async(id)=>{const response=await fetch("/api/admin/personnel/"+id,{method:"DELETE"});return response.status;},personnelId);
  expect(forbiddenStatus).toBe(403);
 }finally{
  await page.unrouteAll({behavior:"ignoreErrors"});
  await personnelContext.close();
  await persitContext.close();
  await komandanContext.close();
 }
});



test("gate API rejects unauthenticated and invalid requests",async({page,request})=>{
 const unauthenticated=await request.get("/api/admin/gates");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const invalid=await page.request.post("/api/admin/gates",{data:{name:"",location:"",status:"BROKEN"}});
 expect(invalid.status()).toBe(422);
});


test("gate management handles empty, loading, network and server error states",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.route("**/api/edge/gates",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})}));
 await page.goto("/admin/gates");
 await expect(page.getByText("Belum ada gate")).toBeVisible();
 await page.unroute("**/api/edge/gates");
 await page.route("**/api/edge/gates",async route=>{
  await new Promise(resolve=>setTimeout(resolve,1500));
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})});
 });
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.getByText("Memuat data gate...")).toBeVisible();
 await expect(page.getByText("Belum ada gate")).toBeVisible();
 await page.unroute("**/api/edge/gates");
 await page.route("**/api/edge/gates",route=>route.abort());
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Koneksi ke server terputus.");
 await page.unroute("**/api/edge/gates");
 await page.route("**/api/edge/gates",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Layanan gate sedang tidak tersedia."})}));
 await page.getByRole("button",{name:"Muat ulang"}).click();
 await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Layanan gate sedang tidak tersedia.");
 await page.unroute("**/api/edge/gates");
});


test("Gate QR credentials are stored as hashes and resolve only for active gates",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const personnelCreated=await page.request.post("/api/admin/personnel",{data:{nrp:"CI-PERSONEL-QR-001",displayName:"Personel QR E2E",rank:"Kapten",position:"Pengujian QR",username:"ci-personel-qr",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(personnelCreated.status()).toBe(201);
 const created=await page.request.post("/api/admin/gates",{data:{name:"Gate QR Credential E2E",location:"Pos Uji QR",status:"AKTIF"}});
 expect(created.status()).toBe(201);
 const createdBody=await created.json();
 const gateId=createdBody.data.id as string;
 const credential=createdBody.qrCredential as string;
 expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const listed=await page.request.get("/api/admin/gates");
 const listedBody=await listed.json();
 const gate=listedBody.data.find((item:{id:string})=>item.id===gateId);
 expect(gate).toBeTruthy();
 expect(JSON.stringify(gate)).not.toContain(credential);
 expect(JSON.stringify(gate)).not.toContain("qrTokenHash");
 const unauthorizedResolve=await page.request.post("/api/personnel/gates/resolve",{data:{credential}});
 expect(unauthorizedResolve.status()).toBe(403);
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-qr",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const valid=await page.evaluate(async credential=>{const response=await fetch("/api/personnel/gates/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential})});return {status:response.status,body:await response.json()};},credential);
 expect(valid.status).toBe(200);
 expect(valid.body.data).toMatchObject({id:gateId,name:"Gate QR Credential E2E",location:"Pos Uji QR"});
 const invalid=await page.evaluate(async()=>{const response=await fetch("/api/personnel/gates/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:"not-a-valid-credential"})});return response.status;});
 expect(invalid).toBe(404);
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const disabled=await page.evaluate(async gateId=>{const response=await fetch("/api/admin/gates/"+gateId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Gate QR Credential E2E",location:"Pos Uji QR",status:"NONAKTIF"})});return response.status;},gateId);
 expect(disabled).toBe(200);
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-qr",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const rejected=await page.evaluate(async credential=>{const response=await fetch("/api/personnel/gates/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential})});return response.status;},credential);
 expect(rejected).toBe(404);
});


test("Personel completes exit and return transactions using active Gate QR",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const createdPersonnel=await page.request.post("/api/admin/personnel",{data:{
  nrp:"CI-PERSONEL-TRANSACTION-001",
  displayName:"Personel Transaksi E2E",
  rank:"Kapten",
  position:"Pengujian Transaksi",
  username:"ci-personel-transaction",
  password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!
 }});
 expect(createdPersonnel.status()).toBe(201);
 const createdPersonnelBody=await createdPersonnel.json();
 const activeGateResponse=await page.request.post("/api/admin/gates",{data:{name:"Gate Transaksi E2E",location:"Pos Transaksi",status:"AKTIF"}});
 expect(activeGateResponse.status()).toBe(201);
 const activeGate=await activeGateResponse.json();
 const credential=activeGate.qrCredential as string;
 expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const inactiveGateResponse=await page.request.post("/api/admin/gates",{data:{name:"Gate Nonaktif Transaksi E2E",location:"Pos Tutup",status:"NONAKTIF"}});
 expect(inactiveGateResponse.status()).toBe(201);
 const inactiveCredential=(await inactiveGateResponse.json()).qrCredential as string;

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-transaction",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await expect(page.getByRole("link",{name:/Scan QR Gate/})).toBeVisible();

 const initial=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return {status:r.status,body:await r.json()};});
 expect(initial.status).toBe(200);
 expect(initial.body.data.presenceStatus).toBe("DI_DALAM");

 const lockClient=new Client({connectionString:process.env.DATABASE_URL});
 await lockClient.connect();
 try{
  await lockClient.query("BEGIN");
  await lockClient.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",[createdPersonnelBody.data.id]);
  const concurrent=await page.evaluate(async token=>{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),2000);
   try{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas",purpose:"Uji lock"}),signal:controller.signal});return r.status;}
   catch{return 0;}
   finally{clearTimeout(timeout);}
  },credential);
  expect(concurrent).toBe(409);
 }finally{
  await lockClient.query("ROLLBACK");
  await lockClient.end();
 }
 const unchangedAfterConcurrent=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return r.json();});
 expect(unchangedAfterConcurrent.data.presenceStatus).toBe("DI_DALAM");

 const missingForm=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token})});return {status:r.status,body:await r.json()};},credential);
 expect(missingForm.status).toBe(422);
 const unchangedAfterMissingForm=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return r.json();});
 expect(unchangedAfterMissingForm.data.presenceStatus).toBe("DI_DALAM");

 const inactive=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas",purpose:"Dinas"})});return {status:r.status,body:await r.json()};},inactiveCredential);
 expect(inactive.status).toBe(404);
 expect(inactive.body.error).toBe("QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi");

 const exit=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas Komando",purpose:"Melaksanakan tugas dinas"})});return {status:r.status,body:await r.json()};},credential);
 expect(exit.status).toBe(200);
 expect(exit.body.data).toMatchObject({direction:"KELUAR",presenceStatus:"DI_LUAR",activityStatus:"AKTIF",gateName:"Gate Transaksi E2E",destination:"Markas Komando",purpose:"Melaksanakan tugas dinas"});
 const outside=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return {status:r.status,body:await r.json()};});
 expect(outside.status).toBe(200);
 expect(outside.body.data.presenceStatus).toBe("DI_LUAR");
 expect(outside.body.data.activeActivity).toMatchObject({destination:"Markas Komando",purpose:"Melaksanakan tugas dinas",exitGate:{name:"Gate Transaksi E2E"}});

 const invalid=await page.evaluate(async()=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:"invalid-token"})});return {status:r.status,body:await r.json()};});
 expect(invalid.status).toBe(404);
 const stillOutside=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return r.json();});
 expect(stillOutside.data.presenceStatus).toBe("DI_LUAR");

 const returned=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token})});return {status:r.status,body:await r.json()};},credential);
 expect(returned.status).toBe(200);
 expect(returned.body.data).toMatchObject({direction:"KEMBALI",presenceStatus:"DI_DALAM",activityStatus:"SELESAI",gateName:"Gate Transaksi E2E"});
 expect(returned.body.data.durationSeconds).toEqual(expect.any(Number));
 const inside=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return {status:r.status,body:await r.json()};});
 expect(inside.status).toBe(200);
 expect(inside.body.data.presenceStatus).toBe("DI_DALAM");
 expect(inside.body.data.activeActivity).toBeNull();

 const expiryClient=new Client({connectionString:process.env.DATABASE_URL});
 await expiryClient.connect();
 try{
  await expiryClient.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = $1",[createdPersonnelBody.data.id]);
 }finally{
  await expiryClient.end();
 }
 const expired=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas",purpose:"Sesi sudah berakhir"})});return r.status;},credential);
 expect(expired).toBe(401);
 await page.goto("/dashboard");
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-personel-transaction",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const unchangedAfterExpiry=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return r.json();});
 expect(unchangedAfterExpiry.data.presenceStatus).toBe("DI_DALAM");
 expect(unchangedAfterExpiry.data.activeActivity).toBeNull();

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const denied=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas",purpose:"Akses role lain"})});return r.status;},credential);
 expect(denied).toBe(403);
});

test("Personel can recover camera permission and complete an exit by scanning QR",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const created=await page.request.post("/api/admin/personnel",{data:{
  nrp:"CI-PERSONEL-CAMERA-001",
  displayName:"Personel Kamera E2E",
  rank:"Kapten",
  position:"Pengujian Kamera",
  username:"ci-personel-camera",
  password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!
 }});
 expect(created.status()).toBe(201);
 const gateResponse=await page.request.post("/api/admin/gates",{data:{name:"Gate Kamera E2E",location:"Pos Kamera",status:"AKTIF"}});
 expect(gateResponse.status()).toBe(201);
 const credential=(await gateResponse.json()).qrCredential as string;
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-camera",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.addInitScript(()=>{
  let attempts=Number(sessionStorage.getItem("gateops-camera-attempts")||"0");
  const testWindow=window as Window & { __qrValue?: string };
  testWindow.__qrValue="";
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>{
   attempts+=1;
   sessionStorage.setItem("gateops-camera-attempts",String(attempts));
   if(attempts===1)throw new DOMException("Permission denied","NotAllowedError");
   return {getTracks:()=>[{stop:()=>{}}]};
  }}});
  Object.defineProperty(HTMLVideoElement.prototype,"srcObject",{configurable:true,get(){return null;},set(){}});
  HTMLVideoElement.prototype.play=()=>Promise.resolve();
  Object.defineProperty(HTMLVideoElement.prototype,"readyState",{configurable:true,get:()=>4});
  Object.defineProperty(window,"BarcodeDetector",{configurable:true,value:class{async detect(){const value=testWindow.__qrValue;if(value){testWindow.__qrValue="";return [{rawValue:value}];}return [];} }});
 });
 await page.goto("/personnel/scan");
 await expect(page.getByRole("button",{name:"Buka kamera untuk keluar"})).toBeDisabled();
 await page.getByLabel("Tujuan").fill("Markas");
 await page.getByLabel("Keperluan").fill("Pengujian izin kamera");
 await expect(page.getByRole("button",{name:"Buka kamera untuk keluar"})).toBeEnabled();
 await page.getByRole("button",{name:"Buka kamera untuk keluar"}).click();
 await expect(page.locator(".scanner-error[role=alert]")).toContainText("Izin kamera ditolak");
 await page.getByRole("button",{name:"Coba buka kamera kembali"}).click();
 await expect(page.getByRole("button",{name:"Hentikan kamera"})).toBeVisible();
 await expect(page.getByRole("status")).toContainText("Arahkan kamera ke QR Code Gate");
 await page.getByRole("button",{name:"Hentikan kamera"}).click();
 await expect(page.getByRole("button",{name:"Buka kamera untuk keluar"})).toBeVisible();
 await page.evaluate(token=>{(window as Window & {__qrValue?:string}).__qrValue=token;},credential);
 await page.getByRole("button",{name:"Buka kamera untuk keluar"}).click();
 await expect(page.getByRole("status")).toContainText("Transaksi keluar berhasil",{timeout:10000});
 const presence=await page.evaluate(async()=>{const response=await fetch("/api/personnel/presence");return {status:response.status,body:await response.json()};});
 expect(presence.status).toBe(200);
 expect(presence.body.data.presenceStatus).toBe("DI_LUAR");
 expect(presence.body.data.activeActivity).toMatchObject({destination:"Markas",purpose:"Pengujian izin kamera",exitGate:{name:"Gate Kamera E2E"}});

 await page.goto("/personnel/scan");
 await expect(page.getByRole("button",{name:"Hentikan kamera"})).toBeVisible();
 await expect(page.getByRole("status")).toContainText("Arahkan kamera ke QR Code Gate");
 await page.getByRole("button",{name:"Hentikan kamera"}).click();
});


test("QR exit persistence failure rolls back activity and presence together",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const created=await page.request.post("/api/admin/personnel",{data:{
  nrp:"CI-PERSONEL-ROLLBACK-001",
  displayName:"Personel Rollback E2E",
  rank:"Kapten",
  position:"Pengujian Rollback",
  username:"ci-personel-rollback",
  password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!
 }});
 expect(created.status()).toBe(201);
 const gateResponse=await page.request.post("/api/admin/gates",{data:{name:"Gate Rollback E2E",location:"Pos Rollback",status:"AKTIF"}});
 expect(gateResponse.status()).toBe(201);
 const credential=(await gateResponse.json()).qrCredential as string;
 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-rollback",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");

 const failureClient=new Client({connectionString:process.env.DATABASE_URL});
 await failureClient.connect();
 try{
  await failureClient.query(`CREATE OR REPLACE FUNCTION gateops_test_fail_presence_update() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.presence_status = 'DI_LUAR' THEN
      RAISE EXCEPTION 'test-only presence persistence failure';
    END IF;
    RETURN NEW;
  END;
  $$`);
  await failureClient.query("DROP TRIGGER IF EXISTS gateops_test_fail_presence_update ON users");
  await failureClient.query("CREATE TRIGGER gateops_test_fail_presence_update BEFORE UPDATE OF presence_status ON users FOR EACH ROW EXECUTE FUNCTION gateops_test_fail_presence_update()");
  const failed=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas",purpose:"Uji rollback"})});return {status:r.status,body:await r.json()};},credential);
  expect(failed.status).toBe(500);
  expect(failed.body.error).toContain("Status kehadiran dan aktivitas tidak berubah");
  const afterFailure=await page.evaluate(async()=>{const r=await fetch("/api/personnel/presence");return {status:r.status,body:await r.json()};});
  expect(afterFailure.status).toBe(200);
  expect(afterFailure.body.data.presenceStatus).toBe("DI_DALAM");
  expect(afterFailure.body.data.activeActivity).toBeNull();
 }finally{
  await failureClient.query("DROP TRIGGER IF EXISTS gateops_test_fail_presence_update ON users");
  await failureClient.query("DROP FUNCTION IF EXISTS gateops_test_fail_presence_update()");
  await failureClient.end();
 }
});


test("GPS latest location is persisted only while personnel is outside and visible to command roles",async({page})=>{
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const created=await page.evaluate(async password=>{
  const r=await fetch("/api/admin/personnel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   nrp:"CI-GPS-NRP-001",displayName:"Personel GPS E2E",rank:"Kapten",position:"Pengujian GPS",
   username:"ci-personel-gps",password
  })});
  return {status:r.status,body:await r.json()};
 },process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 expect(created.status).toBe(201);
 const gate=await page.evaluate(async()=>{const r=await fetch("/api/admin/gates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Gate GPS E2E",location:"Pos GPS",status:"AKTIF"})});return {status:r.status,body:await r.json()};});
 expect(gate.status).toBe(201);
 const credential=gate.body.qrCredential as string;

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-gps",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const exit=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Lokasi GPS",purpose:"Uji tracking GPS"})});return r.status;},credential);
 expect(exit).toBe(200);

 await page.context().grantPermissions(["geolocation"]);
 await page.context().setGeolocation({latitude:-6.2,longitude:106.816666});
 await page.goto("/dashboard");
 const gpsClient=new Client({connectionString:process.env.DATABASE_URL});
 await gpsClient.connect();
 try{
  await expect.poll(async()=>{const q=await gpsClient.query("SELECT gps_latitude FROM users WHERE username = $1",["ci-personel-gps"]);return q.rows[0]?.gps_latitude??null;},{timeout:10000}).toBe(-6.2);
 }finally{
  await gpsClient.end();
 }
 const saved=await page.evaluate(async()=>{const r=await fetch("/api/personnel/gps/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:-6.210000,longitude:106.826666})});return {status:r.status,body:await r.json()};});
 expect(saved.status).toBe(200);
 // Revoking a previously granted browser permission must immediately mark the GPS feed offline.
 const permissionClient=await page.context().newCDPSession(page);
 const targetInfo=await permissionClient.send("Target.getTargetInfo");
 const browserContextId=targetInfo.targetInfo.browserContextId;
 expect(browserContextId).toBeTruthy();
 await permissionClient.send("Browser.setPermission",{permission:{name:"geolocation"},setting:"denied",origin:new URL(page.url()).origin,browserContextId});
 await expect.poll(async()=>page.evaluate(async()=> (await navigator.permissions.query({name:"geolocation"})).state),{timeout:5000}).toBe("denied");
 const permissionDb=new Client({connectionString:process.env.DATABASE_URL});
 await permissionDb.connect();
 try{
  await expect.poll(async()=>{const q=await permissionDb.query("SELECT gps_permission_revoked_at FROM users WHERE username = $1",["ci-personel-gps"]);return q.rows[0]?.gps_permission_revoked_at??null;},{timeout:10000}).not.toBeNull();
 }finally{
  await permissionDb.end();
 }
 // Set the browser's real position before granting permission: the permission-change
 // handler immediately calls getCurrentPosition as soon as "granted" is observed.
 await page.context().setGeolocation({latitude:-6.21,longitude:106.826666});
 await permissionClient.send("Browser.setPermission",{permission:{name:"geolocation"},setting:"granted",origin:new URL(page.url()).origin,browserContextId});
 await expect.poll(async()=>page.evaluate(async()=> (await navigator.permissions.query({name:"geolocation"})).state),{timeout:5000}).toBe("granted");
 const recoveryDb=new Client({connectionString:process.env.DATABASE_URL});
 await recoveryDb.connect();
 try{
  await expect.poll(async()=>{const q=await recoveryDb.query("SELECT gps_permission_revoked_at, gps_updated_at FROM users WHERE username = $1",["ci-personel-gps"]);return q.rows[0]?.gps_permission_revoked_at===null&&q.rows[0]?.gps_updated_at!==null;},{timeout:10000}).toBe(true);
 }finally{
  await recoveryDb.end();
 }
 const deniedRead=await page.evaluate(async()=>{const r=await fetch("/api/gps/locations");return r.status;});
 expect(deniedRead).toBe(403);

 // CI has no hosted Supabase project: feed the new dashboard BFF path from the
 // existing database-backed route so browser rendering remains a real DB-backed test.
 await page.route("**/api/edge/gps-locations", async route=>{
  const legacyUrl=new URL("/api/gps/locations",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const locationCard=page.locator(".gps-location-card").filter({hasText:"Personel GPS E2E"});
 await expect(locationCard).toBeVisible();
 await expect(page.getByRole("region",{name:"Peta GPS personel"})).toBeVisible();
 const mapMarker=page.getByRole("button",{name:/Lokasi Personel GPS E2E, status GPS AKTIF/});
 await expect(mapMarker).toBeVisible();
 await mapMarker.click();
 await expect(page.locator(".gps-map-popup")).toContainText("Personel GPS E2E");
 await expect(page.locator(".gps-map-popup")).toContainText("AKTIF");
 await expect(page.locator(".gps-map-attribution")).toContainText("OpenStreetMap contributors");
 await expect(locationCard).toContainText("-6.210000");
 await expect(locationCard).toContainText("106.826666");
 const visible=await page.evaluate(async()=>{const r=await fetch("/api/gps/locations");return {status:r.status,body:await r.json()};});
 expect(visible.status).toBe(200);
 expect(visible.body.data).toEqual(expect.arrayContaining([expect.objectContaining({displayName:"Personel GPS E2E",gpsLatitude:-6.21,gpsLongitude:106.826666,gpsStatus:"AKTIF"})]));

 const staleClient=new Client({connectionString:process.env.DATABASE_URL});
 await staleClient.connect();
 try {
  await staleClient.query("UPDATE users SET gps_updated_at = NOW() - INTERVAL '61 seconds' WHERE username = $1",["ci-personel-gps"]);
 } finally {
  await staleClient.end();
 }
 const offline=await page.evaluate(async()=>{const r=await fetch("/api/gps/locations");return {status:r.status,body:await r.json()};});
 expect(offline.status).toBe(200);
 expect(offline.body.data).toEqual(expect.arrayContaining([expect.objectContaining({displayName:"Personel GPS E2E",gpsStatus:"OFFLINE"})]));
 await page.reload();
 await expect(page.locator(".gps-location-card").filter({hasText:"Personel GPS E2E"}).locator(".gps-offline-label")).toHaveText("OFFLINE");

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-personel-gps",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const returnResult=await page.evaluate(async token=>{const r=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token})});return r.status;},credential);
 expect(returnResult).toBe(200);
 const afterReturn=await page.evaluate(async()=>{const r=await fetch("/api/personnel/gps/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:-6.3,longitude:106.9})});return r.status;});
 expect(afterReturn).toBe(409);

 await page.getByRole("button",{name:"Keluar"}).click();
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const noLongerOutside=await page.evaluate(async()=>{const r=await fetch("/api/gps/locations");return {status:r.status,body:await r.json()};});
 expect(noLongerOutside.status).toBe(200);
 expect(noLongerOutside.body.data.some((item:{displayName:string})=>item.displayName==="Personel GPS E2E")).toBe(false);
 await page.unrouteAll({behavior:"ignoreErrors"});
});


test("activity history is persisted, filtered, and isolated across roles",async({page})=>{
 await page.route("**/api/edge/activities*", async route=>{
  const incoming=new URL(route.request().url());
  const legacyUrl=new URL("/api/activities"+incoming.search,incoming).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 await page.route("**/api/edge/activity-detail*", async route=>{
  const incoming=new URL(route.request().url());
  const id=incoming.searchParams.get("id")??"";
  const legacyUrl=new URL("/api/activities/"+encodeURIComponent(id),incoming).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const unauthenticated=await page.request.get("/api/edge/activities");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const person=await page.request.post("/api/admin/personnel",{data:{
  nrp:"CI-HISTORY-NRP-001",displayName:"Personel Riwayat E2E",rank:"Kapten",position:"Pengujian Riwayat",
  username:"ci-personel-history",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!
 }});
 expect(person.status()).toBe(201);
 const gate=await page.request.post("/api/admin/gates",{data:{name:"Gate Riwayat E2E",location:"Pos Riwayat",status:"AKTIF"}});
 expect(gate.status()).toBe(201);
 const credential=(await gate.json()).qrCredential as string;
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-personel-history",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const exit=await page.evaluate(async token=>{
  const response=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas Komando",purpose:"Uji riwayat aktivitas"})});
  return {status:response.status,body:await response.json()};
 },credential);
 expect(exit.status).toBe(200);
 await page.goto("/personnel/history");
 await expect(page.getByRole("heading",{name:"Riwayat Aktivitas Pribadi"})).toBeVisible();
 const row=page.getByRole("row").filter({hasText:"Markas Komando"});
 await expect(row).toBeVisible();
 await expect(row).toContainText("AKTIF");
 await expect(row).toContainText("Gate Riwayat E2E");
 await expect(row).toContainText("—");
 const activityId=await page.evaluate(async()=>{
  const response=await fetch("/api/edge/activities");
  const body=await response.json();
  return body.data[0].id as string;
 });
 const ownDetail=await page.evaluate(async id=>{
  const response=await fetch("/api/edge/activity-detail?id="+encodeURIComponent(id));
  return {status:response.status,body:await response.json()};
 },activityId);
 expect(ownDetail.status).toBe(200);
 const ownBody=ownDetail.body;
 expect(ownBody.data.destination).toBe("Markas Komando");
 expect(ownBody.data.durationSeconds).toBeNull();
 await page.getByRole("button",{name:"Lihat detail"}).first().click();
 await expect(page.getByRole("heading",{name:"Detail Aktivitas"})).toBeVisible();
 await expect(page.getByText("Uji riwayat aktivitas")).toBeVisible();
 await page.goto("/personnel/history/"+activityId);
 await expect(page.getByRole("heading",{name:"Detail Aktivitas"})).toBeVisible();
 await expect(page.getByText("Pos Riwayat")).toBeVisible();
 await page.locator('a.secondary-button[href="/personnel/history"]').click();
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/history");
 await expect(page.getByRole("heading",{name:"Riwayat Aktivitas",exact:true})).toBeVisible();
 await expect(page.getByText("Personel Riwayat E2E")).toBeVisible();
 await page.getByLabel("Nama personel").fill("Tidak Ada Nama");
 await page.getByRole("button",{name:"Terapkan filter"}).click();
 await expect(page.getByText("Belum ada riwayat aktivitas")).toBeVisible();
 await page.getByRole("button",{name:"Reset"}).click();
 await expect(page.getByText("Personel Riwayat E2E")).toBeVisible();
 const secondPerson=await page.request.post("/api/admin/personnel",{data:{nrp:"CI-HISTORY-NRP-002",displayName:"Personel Lain Riwayat E2E",rank:"Letnan",position:"Uji Isolasi",username:"ci-personel-history-other",password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!}});
 expect(secondPerson.status()).toBe(201);
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-personel-history-other",process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const otherList=await page.evaluate(async()=>{
  const response=await fetch("/api/edge/activities");
  return {status:response.status,body:await response.json()};
 });
 expect(otherList.status).toBe(200);
 expect(otherList.body.data.some((item:{id:string})=>item.id===activityId)).toBe(false);
 const otherDetail=await page.evaluate(async id=>{
  const response=await fetch("/api/edge/activity-detail?id="+encodeURIComponent(id));
  return {status:response.status,body:await response.json()};
 },activityId);
 expect(otherDetail.status).toBe(404);
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/history");
 await expect(page.getByText("Personel Riwayat E2E")).toBeVisible();
 await expect(page.getByRole("button",{name:"Terapkan filter"})).toBeVisible();
 await page.goto("/dashboard");
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-persit-pending",process.env.SEED_PERSIT_PENDING_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 await page.goto("/admin/history");
 await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
 const forbiddenApi=await page.evaluate(async()=>{const response=await fetch("/api/edge/activities");return response.status;});
 expect(forbiddenApi).toBe(403);
 const forbiddenDetail=await page.evaluate(async id=>{const response=await fetch("/api/edge/activity-detail?id="+encodeURIComponent(id));return response.status;},activityId);
 expect(forbiddenDetail).toBe(403);
 await page.unrouteAll({behavior:"ignoreErrors"});
});


test("report data endpoint returns persisted report fields only to command roles",async({page})=>{
 // The CI browser uses PostgreSQL-backed parity until a hosted Supabase project is configured.
 await page.route("**/api/edge/reports-data", async route=>{
  const legacyUrl=new URL("/api/reports/data",route.request().url()).toString();
  const response=await route.fetch({url:legacyUrl});
  await route.fulfill({response});
 });
 const unauthenticated=await page.request.get("/api/edge/reports-data");
 expect(unauthenticated.status()).toBe(401);
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const suffix=Date.now().toString();
 const person=await page.evaluate(async({suffix,password})=>{
  const response=await fetch("/api/admin/personnel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   nrp:"CI-REPORT-"+suffix,displayName:"Personel Laporan E2E "+suffix,rank:"Kapten",position:"Pengujian Laporan",
   username:"ci-report-"+suffix,password
  })});
  return {status:response.status,body:await response.json()};
 },{suffix,password:process.env.E2E_CREATED_ACCOUNT_PASSWORD!});
 expect(person.status).toBe(201);
 const gate=await page.evaluate(async suffix=>{
  const response=await fetch("/api/admin/gates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Gate Laporan "+suffix,location:"Pos Laporan",status:"AKTIF"})});
  return {status:response.status,body:await response.json()};
 },suffix);
 expect(gate.status).toBe(201);
 const credential=gate.body.qrCredential as string;
 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-report-"+suffix,process.env.E2E_CREATED_ACCOUNT_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const exit=await page.evaluate(async token=>{
  const response=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token,destination:"Markas Laporan",purpose:"Verifikasi dataset PDF"})});
  return response.status;
 },credential);
 expect(exit).toBe(200);
 const returned=await page.evaluate(async token=>{
  const response=await fetch("/api/personnel/gates/transaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:token})});
  return response.status;
 },credential);
 expect(returned).toBe(200);
 const deniedPersonnel=await page.evaluate(async()=> (await fetch("/api/edge/reports-data")).status);
 expect(deniedPersonnel).toBe(403);

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const adminResult=await page.evaluate(async()=>{const response=await fetch("/api/edge/reports-data");return {status:response.status,body:await response.json()};});
 expect(adminResult.status).toBe(200);
 expect(adminResult.body.data.statistics.exitTransactions).toBeGreaterThanOrEqual(1);
 expect(adminResult.body.data.statistics.returnTransactions).toBeGreaterThanOrEqual(1);
 const activity=adminResult.body.data.activities.find((item:{personnelName:string;destination:string;purpose:string;status:string;returnGate:string|null})=>
  item.personnelName==="Personel Laporan E2E "+suffix && item.destination==="Markas Laporan"
 );
 expect(activity).toBeTruthy();
 expect(activity).toMatchObject({destination:"Markas Laporan",purpose:"Verifikasi dataset PDF",status:"SELESAI",returnGate:"Gate Laporan "+suffix});
 expect(activity.returnAt).toBeTruthy();
 expect(activity.durationSeconds).not.toBeNull();
 expect(JSON.stringify(adminResult.body)).not.toMatch(/passwordHash|tokenHash|gpsLatitude|gpsLongitude|qrToken/i);

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
 const commanderResult=await page.evaluate(async()=>{const response=await fetch("/api/edge/reports-data");return {status:response.status,body:await response.json()};});
 expect(commanderResult.status).toBe(200);
 expect(commanderResult.body.data.activities.some((item:{destination:string})=>item.destination==="Markas Laporan")).toBe(true);

 await page.getByRole("button",{name:"Keluar"}).click();
 await expect(page).toHaveURL(url=>url.pathname==="/login");
 await login(page,"ci-persit-pending",process.env.SEED_PERSIT_PENDING_PASSWORD!);
 await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  const deniedPersit=await page.evaluate(async()=> (await fetch("/api/edge/reports-data")).status);
  expect(deniedPersit).toBe(403);
});

test("report page UI displays statistics and activity table for Super Admin and Komandan",async({page})=>{
  await page.route("**/api/edge/reports-data", async route=>{
    const legacyUrl=new URL("/api/reports/data",route.request().url()).toString();
    const response=await route.fetch({url:legacyUrl});
    await route.fulfill({response});
  });
  const unauthenticated=await page.request.get("/api/edge/reports-data");
  expect(unauthenticated.status()).toBe(401);

  await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await expect(page.getByRole("link",{name:/Laporan/})).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Laporan Kehadiran & Aktivitas"})).toBeVisible();

  const adminResult=await page.evaluate(async()=>{const response=await fetch("/api/edge/reports-data");return await response.json();});
  const stats=page.locator(".report-stat-card strong");
  await expect(stats.nth(0)).toHaveText(String(adminResult.body.data.statistics.totalPersonnel));
  await expect(stats.nth(1)).toHaveText(String(adminResult.body.data.statistics.insidePersonnel));
  await expect(stats.nth(2)).toHaveText(String(adminResult.body.data.statistics.outsidePersonnel));
  await expect(stats.nth(3)).toHaveText(String(adminResult.body.data.statistics.exitTransactions));
  await expect(stats.nth(4)).toHaveText(String(adminResult.body.data.statistics.returnTransactions));

  if (adminResult.body.data.activities.length > 0) {
    const first=adminResult.body.data.activities[0];
    const row=page.getByRole("row").filter({hasText:first.personnelName});
    await expect(row).toBeVisible();
    await expect(row).toContainText(first.destination);
    await expect(row).toContainText(first.status);
  }

  await page.getByRole("button",{name:"Keluar"}).click();
  await login(page,"ci-komandan",process.env.SEED_KOMANDAN_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Laporan Kehadiran & Aktivitas"})).toBeVisible();
  const commanderStats=page.locator(".report-stat-card strong");
  await expect(commanderStats.nth(0)).toBeVisible();

  await page.getByRole("button",{name:"Keluar"}).click();
  await login(page,"ci-personel",process.env.SEED_PERSONEL_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(url=>url.pathname==="/forbidden");

  await page.getByRole("button",{name:"Keluar"}).click();
  await login(page,"ci-persit-pending",process.env.SEED_PERSIT_PENDING_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(url=>url.pathname==="/forbidden");
  await page.unrouteAll({behavior:"ignoreErrors"});
});

test("report page handles loading, empty, network and server error states",async({page})=>{
  await login(page,"ci-admin",process.env.SEED_SUPER_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(url=>url.pathname==="/dashboard");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Laporan Kehadiran & Aktivitas"})).toBeVisible();

  await page.route("**/api/edge/reports-data",async route=>{
    await new Promise(resolve=>setTimeout(resolve,1200));
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:{statistics:{totalPersonnel:0,insidePersonnel:0,outsidePersonnel:0,exitTransactions:0,returnTransactions:0},activities:[]}})});
  });
  await page.getByRole("button",{name:"Perbarui data"}).click();
  await expect(page.getByText("Memuat data laporan...")).toBeVisible({timeout:5000});
  await expect(page.getByText("Belum ada aktivitas yang tercatat.")).toBeVisible({timeout:10000});
  await page.unroute("**/api/edge/reports-data");

  await page.route("**/api/edge/reports-data",route=>route.abort());
  await page.getByRole("button",{name:"Perbarui data"}).click();
  await expect(page.locator(".admin-page > .form-error[role=alert]")).toContainText("Koneksi ke server terputus.");
  await page.unroute("**/api/edge/reports-data");

  await page.route("**/api/edge/reports-data",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Layanan laporan sedang tidak tersedia."})}));
  await page.getByRole("button",{name:"Perbarui data"}).click();
  await expect(page.locator(".form-error[role='alert']")).toContainText("Layanan laporan sedang tidak tersedia.");
  await page.unroute("**/api/edge/reports-data");
});
