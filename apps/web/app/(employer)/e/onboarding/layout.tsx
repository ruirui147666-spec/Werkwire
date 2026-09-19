import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EmployerOnboardingLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("employer");

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_user_id", profile.id)
    .maybeSingle();

  if (company) redirect("/e");

  return children;
}
