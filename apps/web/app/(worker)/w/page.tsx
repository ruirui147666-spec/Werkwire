import { redirect } from "next/navigation";
import { explainNoMatches } from "@werkwire/matching-engine";
import type { ScoreBreakdown } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";
import { WorkerMatchesList, type WorkerMatchView } from "@/components/match/WorkerMatchesList";
import { CONTRACT_LABELS, SECTORS, WORK_MODE_LABELS } from "@/lib/domain/catalog";

const SECTOR_LABEL = Object.fromEntries(SECTORS.map((s) => [s.slug, s.label]));

export default async function WorkerHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/w");

  const { data: workerProfile } = await supabase
    .from("worker_profiles")
    .select("id, salary_min")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workerProfile) redirect("/w/onboarding");

  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "id, status, harmonic_score, explanation_worker, score_breakdown, expires_at, created_at, jobs(id, title, sector, location_label, salary_min, salary_max, contract, work_mode, company_id)"
    )
    .eq("worker_id", workerProfile.id)
    .order("created_at", { ascending: false });

  const companyIds = Array.from(new Set((matchRows ?? []).map((m: any) => m.jobs?.company_id).filter(Boolean)));
  const { data: companies } =
    companyIds.length > 0
      ? await supabase.from("companies_public").select("*").in("id", companyIds)
      : { data: [] as any[] };
  const companyById = new Map((companies ?? []).map((c: any) => [c.id, c]));

  const matches: WorkerMatchView[] = (matchRows ?? [])
    .filter((m: any) => m.jobs)
    .map((m: any) => {
      const job = m.jobs;
      const company = companyById.get(job.company_id);
      const aboutLines = company
        ? [
            company.response_rate_48h != null
              ? `Responde em média em ${Math.round(company.avg_response_hours ?? 0)}h · ${Math.round(company.response_rate_48h * 100)}% de resposta`
              : "Empresa ainda sem histórico de resposta",
            `${company.total_hires ?? 0} contratações pela Werkwire${company.verification_level === "full" ? " · Verificado" : ""}`,
          ]
        : ["Empresa ainda sem histórico"];

      return {
        id: m.id,
        status: m.status,
        harmonicScore: Number(m.harmonic_score),
        title: job.title,
        subtitle: `${SECTOR_LABEL[job.sector] ?? job.sector} · ${job.location_label}`,
        salaryLine: `${job.salary_min}–${job.salary_max}€ · ${CONTRACT_LABELS[job.contract] ?? job.contract} · ${WORK_MODE_LABELS[job.work_mode] ?? job.work_mode}`,
        explanation: m.explanation_worker,
        aboutLines,
        expiresAt: m.expires_at,
        scoreBreakdown: m.score_breakdown as ScoreBreakdown,
      };
    });

  const activeMatches = matches.filter((m) => m.status !== "expired" && !m.status.startsWith("declined"));

  if (activeMatches.length === 0) {
    const negativeText = explainNoMatches(
      { salary_min: workerProfile.salary_min } as any,
      1050,
      Math.max(1, Math.round(workerProfile.salary_min / 120))
    );

    return (
      <div className="container-app max-w-lg py-10 text-center">
        <h1 className="mb-2 text-xl font-semibold text-ink-900">Sem matches por agora</h1>
        <p className="text-sm text-ink-500">{negativeText}</p>
      </div>
    );
  }

  return (
    <div className="container-app max-w-lg py-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-900">Os seus matches</h1>
      <WorkerMatchesList matches={activeMatches} />
    </div>
  );
}
