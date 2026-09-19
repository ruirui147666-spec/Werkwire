import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { hoursUntil } from "@/lib/domain/explain";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  demoted: "Despromovida",
  filled: "Preenchida",
  closed: "Fechada",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  demoted: "warning",
  filled: "neutral",
  closed: "danger",
};

export default async function EmployerJobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user!.id).single();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, salary_min, salary_max, location_label, positions_count, created_at")
    .eq("company_id", company!.id)
    .order("created_at", { ascending: false });

  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: matchRows } =
    jobIds.length > 0
      ? await supabase.from("matches").select("id, job_id, status, expires_at").in("job_id", jobIds)
      : { data: [] as any[] };

  const matchCountByJob = new Map<string, number>();
  const pendingByJob = new Map<string, number>();
  let earliestPendingExpiry: string | null = null;
  let pendingTotal = 0;

  for (const m of matchRows ?? []) {
    matchCountByJob.set(m.job_id, (matchCountByJob.get(m.job_id) ?? 0) + 1);
    if (m.status === "pending" || m.status === "worker_accepted") {
      pendingByJob.set(m.job_id, (pendingByJob.get(m.job_id) ?? 0) + 1);
      pendingTotal++;
      if (!earliestPendingExpiry || m.expires_at < earliestPendingExpiry) earliestPendingExpiry = m.expires_at;
    }
  }

  return (
    <div className="container-app max-w-3xl py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">As suas vagas</h1>
        <Link href="/e/jobs/new">
          <Button size="sm">
            <Plus size={16} /> Nova vaga
          </Button>
        </Link>
      </div>

      {pendingTotal > 0 && earliestPendingExpiry && (
        <Card className="mb-4 flex items-start gap-3 border-warn-300 bg-warn-50">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn-500" />
          <p className="text-sm text-ink-700">
            Tem <strong>{pendingTotal}</strong> {pendingTotal === 1 ? "match" : "matches"} por responder. O mais
            urgente expira em <strong>{hoursUntil(earliestPendingExpiry)}h</strong>.
          </p>
        </Card>
      )}

      {!jobs || jobs.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-ink-500">Ainda não publicou nenhuma vaga.</p>
          <Link href="/e/jobs/new" className="mt-4 inline-block">
            <Button>Publicar a primeira vaga</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{job.title}</h3>
                  <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                </div>
                <p className="text-sm text-ink-500">
                  {job.location_label} · {job.salary_min}–{job.salary_max}€ · {job.positions_count}{" "}
                  {job.positions_count === 1 ? "posição" : "posições"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-ink-900">{matchCountByJob.get(job.id) ?? 0}</p>
                <p className="text-xs text-ink-400">matches</p>
                {(pendingByJob.get(job.id) ?? 0) > 0 && (
                  <Badge tone="warning" className="mt-1">
                    {pendingByJob.get(job.id)} por responder
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
