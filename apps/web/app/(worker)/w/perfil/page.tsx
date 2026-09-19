import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileStatusCard } from "@/components/profile/ProfileStatusCard";
import { ProfileTips } from "@/components/profile/ProfileTips";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VERIFICATION_LEVELS } from "@werkwire/shared";

const VERIFICATION_LABEL: Record<(typeof VERIFICATION_LEVELS)[number], string> = {
  none: "Sem verificação",
  phone: "Telemóvel verificado",
  email: "Email verificado",
  identity: "Identidade verificada",
  full: "Totalmente verificado",
};

export default async function WorkerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/w/perfil");

  const { data: worker } = await supabase
    .from("worker_profiles")
    .select("headline, availability, skills, salary_min, salary_ideal, location_label, verification_level, licences")
    .eq("user_id", user.id)
    .single();

  if (!worker) redirect("/w/onboarding");

  return (
    <div className="container-app max-w-lg py-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-900">Perfil</h1>

      <ProfileStatusCard availability={worker.availability} />

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900">{worker.headline}</h3>
          <Badge tone={worker.verification_level === "full" ? "success" : "neutral"}>
            {VERIFICATION_LABEL[worker.verification_level as keyof typeof VERIFICATION_LABEL]}
          </Badge>
        </div>
        <p className="mb-2 text-sm text-ink-500">{worker.location_label}</p>
        <p className="mb-3 text-sm text-ink-700">
          Salário mínimo: <strong>{worker.salary_min}€</strong>
          {worker.salary_ideal ? ` · ideal ${worker.salary_ideal}€` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(worker.skills as { label: string }[]).map((s, i) => (
            <Badge key={i}>{s.label}</Badge>
          ))}
        </div>
      </Card>

      <ProfileTips />
    </div>
  );
}
