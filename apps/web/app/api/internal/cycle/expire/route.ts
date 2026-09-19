import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

const DEMOTION_THRESHOLD = 0.5;
const DEMOTION_MIN_SAMPLE = 5;
const DEMOTION_TO_PAUSE_DAYS = 14;

/**
 * Job de hora a hora (§6.4): expira matches vencidos, recalcula a
 * reputação das empresas e aplica despromoção/pausa automática.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${serverEnv.CYCLE_TRIGGER_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1) Expirar matches vencidos que ainda não fecharam (pending ou só um
  // lado aceitou). Quem já respondeu não é penalizado — é apenas um status.
  const { data: expiredMatches, error: expireErr } = await admin
    .from("matches")
    .update({ status: "expired" })
    .lt("expires_at", nowIso)
    .in("status", ["pending", "worker_accepted", "employer_accepted"])
    .select("id, job_id");
  if (expireErr) return NextResponse.json({ error: expireErr.message }, { status: 500 });

  // 2) Recalcular reputação por empresa.
  const { data: companies, error: companiesErr } = await admin.from("companies").select("id");
  if (companiesErr) return NextResponse.json({ error: companiesErr.message }, { status: 500 });

  let demotedCount = 0;
  let pausedCount = 0;

  for (const company of companies ?? []) {
    const { data: jobIdsRows } = await admin.from("jobs").select("id").eq("company_id", company.id);
    const jobIds = (jobIdsRows ?? []).map((j) => j.id);
    if (jobIds.length === 0) continue;

    const { data: matches } = await admin
      .from("matches")
      .select("id, status, created_at, employer_responded_at")
      .in("job_id", jobIds)
      .neq("status", "pending");

    const total = matches?.length ?? 0;
    const responded = (matches ?? []).filter((m) => m.employer_responded_at);
    const within48h = responded.filter((m) => {
      const hours = (new Date(m.employer_responded_at as string).getTime() - new Date(m.created_at).getTime()) / 3.6e6;
      return hours <= 48;
    });
    const responseRate48h = total > 0 ? within48h.length / total : null;
    const avgResponseHours =
      responded.length > 0
        ? responded.reduce(
            (sum, m) => sum + (new Date(m.employer_responded_at as string).getTime() - new Date(m.created_at).getTime()) / 3.6e6,
            0
          ) / responded.length
        : null;

    const { count: hireCount } = await admin
      .from("hires")
      .select("id", { count: "exact", head: true })
      .in("match_id", (matches ?? []).map((m) => m.id));
    const confirmedCount = (matches ?? []).filter((m) => m.status === "confirmed").length;
    const hireRate = confirmedCount > 0 ? (hireCount ?? 0) / confirmedCount : null;

    await admin
      .from("companies")
      .update({
        response_rate_48h: responseRate48h,
        avg_response_hours: avgResponseHours,
        hire_rate: hireRate,
        total_hires: hireCount ?? 0,
      })
      .eq("id", company.id);

    // 3) Despromoção automática (prioridade efetivamente ao zero: excluída
    // do próximo ciclo até recuperar — simplificação do "×0.4" da spec).
    if (responseRate48h !== null && responseRate48h < DEMOTION_THRESHOLD && total >= DEMOTION_MIN_SAMPLE) {
      const { data: demoted } = await admin
        .from("jobs")
        .update({ status: "demoted", demoted_at: nowIso })
        .eq("company_id", company.id)
        .eq("status", "active")
        .is("demoted_at", null)
        .select("id");
      demotedCount += demoted?.length ?? 0;

      const cutoff = new Date(now.getTime() - DEMOTION_TO_PAUSE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: paused } = await admin
        .from("jobs")
        .update({ status: "paused" })
        .eq("company_id", company.id)
        .eq("status", "demoted")
        .lt("demoted_at", cutoff)
        .select("id");
      pausedCount += paused?.length ?? 0;
    } else if (responseRate48h !== null && responseRate48h >= DEMOTION_THRESHOLD) {
      // Recuperou — desbloqueia vagas despromovidas.
      await admin
        .from("jobs")
        .update({ status: "active", demoted_at: null })
        .eq("company_id", company.id)
        .eq("status", "demoted");
    }
  }

  return NextResponse.json({
    ok: true,
    expired_matches: expiredMatches?.length ?? 0,
    demoted_jobs: demotedCount,
    paused_jobs: pausedCount,
  });
}
