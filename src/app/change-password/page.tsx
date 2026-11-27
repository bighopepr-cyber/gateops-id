import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
export default async function ChangePasswordPage(){const user=await requireUser();return <ChangePasswordForm forced={user.mustChangePassword}/>;}
