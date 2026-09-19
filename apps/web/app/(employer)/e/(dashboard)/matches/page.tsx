import type { ScoreBreakdown } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";
import { EmployerMatchesList, type EmployerMatchView } from "@/components/match/EmployerMatchesList";
import { CONTRACT_LABELS, WORK_MODE_LABELS } from "@/lib/domain/catalog";

export default async function EmployerMatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user!.id).single();
  const { data: jobRows } = await supabase.from("jobs").select("id, title, sector, location_label, salary_min, salary_max, contract, work_mode").eq("company_id", company!.id);
  const jobById = new Map((jobRows ?? []).map((j) => [j.id, j]));
  const jobIds = (jobRows ?? []).map((j) => j.id);

  const { data: matchRows } =
    jobIds.length > 0
      ? await supabase
          .from("matches")
          .select("id, status, harmonic_score, explanation_employer, score_breakdown, expires_at, created_at, worker_id, job_id")
          .in("job_id", jobIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

  const workerIds = Array.from(new Set((matchRows ?? []).map((m: any) => m.worker_id)));
  const { data: workers } =
    workerIds.length > 0
      ? await supabase.from("worker_profiles_anonymous").select("*").in("id", workerIds)
      : { data: [] as any[] };
  const workerById = new Map((workers ?? []).map((w: any) => [w.id, w]));

  const matches: EmployerMatchView[] = (matchRows ?? [])
    .map((m: any) => {
      const job = jobById.get(m.job_id);
      const worker = workerById.get(m.worker_id);
      if (!job || !worker) return null;

      return {
        id: m.id,
        status: m.status,
        harmonicScore: Number(m.harmonic_score),
        title: worker.headline ?? worker.display_alias,
        subtitle: `${worker.display_alias} · ${worker.location_label}`,
        salaryLine: `Para: ${job.title} · ${CONTRACT_LABELS[job.contract] ?? job.contract} · ${WORK_MODE_LABELS[job.work_mode] ?? job.work_mode}`,
        explanation: m.explanation_employer,
        aboutLines: [
          `${worker.years_experience} anos de experiência`,
          worker.verification_level === "full" ? "Identidade verificada" : `Verificação: ${worker.verification_level}`,
        ],
        expiresAt: m.expires_at,
        scoreBreakdown: m.score_breakdown as ScoreBreakdown,
      };
    })
    .filter((m): m is EmployerMatchView => m !== null);

  const activeMatches = matches.filter((m) => m.status !== "expired" && !m.status.startsWith("declined"));

  return (
    <div className="container-app max-w-lg py-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-900">Matches</h1>
      {activeMatches.length === 0 ? (
        <p className="text-sm text-ink-500">Ainda não há matches para as suas vagas.</p>
      ) : (
        <EmployerMatchesList matches={activeMatches} />
      )}
    </div>
  );
}
