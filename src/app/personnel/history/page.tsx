import { ActivityHistory } from "@/components/activity-history";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PersonalHistoryPage() {
  const user = await requireRole(["PERSONEL"]);
  if (user.mustChangePassword) redirect("/change-password");
  return (
    <>
      <header className="topbar"><div><span className="breadcrumb">Personel</span><span className="breadcrumb-separator">/</span><strong>Riwayat Pribadi</strong></div><span className="secure-label">{user.displayName}</span></header>
      <div className="page-content"><ActivityHistory scope="personal" /></div>
    </>
  );
}
