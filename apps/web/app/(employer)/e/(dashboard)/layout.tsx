import { redirect } from "next/navigation";
import { Briefcase, CreditCard, Handshake } from "lucide-react";
import { NavShell } from "@/components/nav/NavShell";
import { Brand } from "@/components/nav/Brand";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { href: "/e", label: "Vagas", icon: Briefcase },
  { href: "/e/matches", label: "Matches", icon: Handshake },
  { href: "/e/billing", label: "Faturação", icon: CreditCard },
];

export default async function EmployerDashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("employer");

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_user_id", profile.id)
    .maybeSingle();

  if (!company) redirect("/e/onboarding");

  return (
    <NavShell items={NAV_ITEMS} brand={<Brand />}>
      {children}
    </NavShell>
  );
}
