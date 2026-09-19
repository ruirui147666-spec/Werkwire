import { NextResponse } from "next/server";
import type { Job, WorkerProfile } from "@werkwire/shared";
import { runMatching } from "@werkwire/matching-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { estimateCommuteMinutes } from "@/lib/commute";
import { cosineSimilarity } from "@/lib/embeddings";

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function toWorkerProfile(row: any): WorkerProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    display_alias: row.display_alias,
    photo_url: row.photo_url,
    headline: row.headline,
    summary: row.summary,
    years_experience: Number(row.years_experience),
    location_point: { lat: row.lat, lng: row.lng },
    location_label: row.location_label,
    max_commute_minutes: row.max_commute_minutes,
    commute_modes: row.commute_modes ?? ["transit"],
    salary_min: row.salary_min,
    salary_ideal: row.salary_ideal,
    accepted_contracts: row.accepted_contracts,
    accepted_work_modes: row.accepted_work_modes,
    availability: row.availability,
    urgent: row.urgent,
    weekly_availability: row.weekly_availability,
    accepts_nights: row.accepts_nights,
    accepts_weekends: row.accepts_weekends,
    skills: row.skills ?? [],
    languages: row.languages ?? [],
    licences: row.licences ?? [],
    certifications: row.certifications ?? [],
    work_authorisation: row.work_authorisation,
    min_age_ok: row.min_age_ok,
    blocked_company_ids: row.blocked_company_ids ?? [],
    blocked_sectors: row.blocked_sectors ?? [],
    hard_nos: row.hard_nos ?? [],
    verification_level: row.verification_level,
    response_rate: row.response_rate,
    interview_show_rate: row.interview_show_rate,
    trust_score: Number(row.trust_score),
    embedding: parseEmbedding(row.embedding),
  };
}

function toJob(row: any): Job {
  return {
    id: row.id,
    company_id: row.company_id,
    title: row.title,
    description: row.description,
    sector: row.sector,
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    contract: row.contract,
    work_mode: row.work_mode,
    location_point: { lat: row.lat, lng: row.lng },
    location_label: row.location_label,
    weekly_schedule: row.weekly_schedule,
    has_nights: row.has_nights,
    has_weekends: row.has_weekends,
    required_skills: row.required_skills,
    min_years_experience: Number(row.min_years_experience),
    required_languages: row.required_languages ?? [],
    required_licences: row.required_licences ?? [],
    required_certs: row.required_certs ?? [],
    requires_work_auth: row.requires_work_auth,
    min_age: row.min_age,
    positions_count: row.positions_count,
    fill_by_date: row.fill_by_date,
    blocked_worker_ids: row.blocked_worker_ids ?? [],
    status: row.status,
    embedding: parseEmbedding(row.embedding),
    published_at: row.published_at,
    reputation: {
      response_rate_48h: row.company_response_rate_48h,
      hire_rate: row.company_hire_rate,
      abandon_rate: row.company_abandon_rate,
      ghost_flag: row.company_ghost_flag ?? false,
      verification_level: row.company_verification_level ?? "none",
    },
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${serverEnv.CYCLE_TRIGGER_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const kind: string = body.kind === "event" ? "event" : "batch";

  const admin = createAdminClient();

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: workerRows, error: workerErr }, { data: jobRows, error: jobErr }] = await Promise.all([
    admin.from("worker_profiles_engine").select("*").neq("availability", "unavailable").gt("last_active_at", sixtyDaysAgo),
    admin.from("jobs_engine").select("*").eq("status", "active"),
  ]);

  if (workerErr) return NextResponse.json({ error: workerErr.message }, { status: 500 });
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  const workers = (workerRows ?? []).map(toWorkerProfile);
  const jobs = (jobRows ?? []).map(toJob);

  const { data: cycle, error: cycleErr } = await admin
    .from("match_cycles")
    .insert({ kind, engine_version: serverEnv.ENGINE_VERSION, weights_version: "pending" })
    .select("id")
    .single();
  if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 500 });

  const { data: existingRows } = await admin.from("matches").select("worker_id, job_id");
  const existingPairs = new Set((existingRows ?? []).map((r) => `${r.worker_id}:${r.job_id}`));

  const { data: activeMatchRows } = await admin
    .from("matches")
    .select("job_id")
    .in("status", ["pending", "worker_accepted", "employer_accepted"]);
  const activeMatchesPerJob = new Map<string, number>();
  for (const row of activeMatchRows ?? []) {
    activeMatchesPerJob.set(row.job_id, (activeMatchesPerJob.get(row.job_id) ?? 0) + 1);
  }

  const commuteMatrix = new Map<string, number>();
  const commuteEstimated = new Map<string, boolean>();
  const similarityMatrix = new Map<string, number>();
  const companySegmentByJobId = new Map<string, string>();
  const jobAgeDays = new Map<string, number>();
  const employerResponseProbability = new Map<string, number>();

  for (const job of jobs) {
    companySegmentByJobId.set(job.id, job.sector);
    if (job.published_at) {
      jobAgeDays.set(job.id, (Date.now() - new Date(job.published_at).getTime()) / (24 * 60 * 60 * 1000));
    }
    employerResponseProbability.set(job.company_id, job.reputation?.response_rate_48h ?? 0.6);

    for (const worker of workers) {
      const estimate = estimateCommuteMinutes(worker.location_point, job.location_point, worker.commute_modes);
      if (estimate.minutes > 180) continue; // well beyond any reasonable commute — acts as the retrieval radius

      const key = `${worker.id}:${job.id}`;
      commuteMatrix.set(key, estimate.minutes);
      commuteEstimated.set(key, true);

      const similarity =
        worker.embedding && job.embedding ? cosineSimilarity(worker.embedding, job.embedding) : 0.5;
      similarityMatrix.set(key, similarity);
    }
  }

  const workerAcceptProbability = new Map<string, number>(workers.map((w) => [w.id, w.response_rate ?? 0.5]));

  const { matches, stats } = runMatching({
    workers,
    jobs,
    companySegmentByJobId,
    commuteMatrix,
    commuteEstimated,
    similarityMatrix,
    existingPairs,
    quotas: { workerDaily: serverEnv.WORKER_DAILY_QUOTA, jobPerCycle: serverEnv.JOB_CYCLE_QUOTA },
    engineVersion: serverEnv.ENGINE_VERSION,
    activeMatchesPerJob,
    jobAgeDays,
    employerResponseProbability,
    workerAcceptProbability,
  });

  const expiresAt = new Date(Date.now() + serverEnv.MATCH_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  if (matches.length > 0) {
    const { error: insertErr } = await admin.from("matches").insert(
      matches.map((m) => ({
        worker_id: m.workerId,
        job_id: m.jobId,
        cycle_id: cycle.id,
        fit_employer: m.fitEmployer,
        fit_worker: m.fitWorker,
        harmonic_score: m.harmonicScore,
        priority_score: m.priorityScore,
        score_breakdown: m.scoreBreakdown,
        engine_version: m.engineVersion,
        weights_version: m.weightsVersion,
        explanation_worker: m.explanationWorker,
        explanation_employer: m.explanationEmployer,
        status: "pending",
        expires_at: expiresAt,
      }))
    );
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await admin
    .from("match_cycles")
    .update({
      finished_at: new Date().toISOString(),
      workers_evaluated: stats.workersEvaluated,
      jobs_evaluated: stats.jobsEvaluated,
      pairs_scored: stats.pairsScored,
      matches_created: stats.matchesCreated,
      weights_version: matches[0]?.weightsVersion ?? "default-v1",
    })
    .eq("id", cycle.id);

  // Notificações (push/email/WhatsApp) ficam fora do alcance desta fase —
  // os matches já ficam visíveis de imediato em /w e /e para ambos os lados.

  return NextResponse.json({ ok: true, cycle_id: cycle.id, stats });
}
