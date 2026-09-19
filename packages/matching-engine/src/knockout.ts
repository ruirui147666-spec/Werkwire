import type { Job, WorkerProfile } from "@werkwire/shared";

export interface KnockoutResult {
  passed: boolean;
  failed: string[];
}

export interface KnockoutContext {
  commuteMinutes: number;
}

/**
 * Binary eliminatory checks. One failure means the pair does not exist.
 * Ordered cheapest-first (pure in-memory comparisons before anything
 * that depends on externally-computed context like commute time).
 */
export function evaluateKnockouts(
  worker: WorkerProfile,
  job: Job,
  ctx: KnockoutContext
): KnockoutResult {
  const failed: string[] = [];

  if (job.blocked_worker_ids.includes(worker.id)) failed.push("blocked_worker");
  if (worker.blocked_company_ids.includes(job.company_id)) failed.push("blocked_company");
  if (worker.blocked_sectors.includes(job.sector)) failed.push("blocked_sector");
  if (worker.availability === "unavailable") failed.push("worker_unavailable");
  if (job.status !== "active") failed.push("job_not_active");

  if (job.requires_work_auth) {
    const ok = worker.work_authorisation === "eu" || worker.work_authorisation === "residence_permit";
    if (!ok) failed.push("work_authorisation");
  }

  if (job.min_age != null && !worker.min_age_ok) failed.push("min_age");

  if (!job.required_licences.every((l) => worker.licences.includes(l))) {
    failed.push("required_licences");
  }

  if (!job.required_certs.every((c) => worker.certifications.includes(c))) {
    failed.push("required_certs");
  }

  if (job.has_nights && !worker.accepts_nights) failed.push("nights");
  if (job.has_weekends && !worker.accepts_weekends) failed.push("weekends");

  if (ctx.commuteMinutes > worker.max_commute_minutes) failed.push("max_commute");

  if (!worker.accepted_work_modes.includes(job.work_mode)) failed.push("work_mode");
  if (!worker.accepted_contracts.includes(job.contract)) failed.push("contract_type");

  for (const hardNo of worker.hard_nos) {
    if (hardNoFails(hardNo, job)) {
      failed.push(`hard_no:${hardNo.type}`);
    }
  }

  for (const reqLang of job.required_languages) {
    const has = worker.languages.find((l) => l.code === reqLang.code);
    if (!has || !meetsLanguageLevel(has.level, reqLang.min_level)) {
      failed.push(`language:${reqLang.code}`);
    }
  }

  return { passed: failed.length === 0, failed };
}

const LANGUAGE_LEVEL_RANK: Record<string, number> = {
  basic: 1,
  intermediate: 2,
  advanced: 3,
  native: 4,
};

function meetsLanguageLevel(have: string, need: string): boolean {
  return (LANGUAGE_LEVEL_RANK[have] ?? 0) >= (LANGUAGE_LEVEL_RANK[need] ?? 0);
}

function hardNoFails(hardNo: { type: string; value?: string | number }, job: Job): boolean {
  switch (hardNo.type) {
    case "no_sundays":
      return job.weekly_schedule.sun.length > 0;
    case "no_freelance":
      return job.contract === "freelance";
    case "no_night_shifts":
      return job.has_nights;
    case "no_sector":
      return job.sector === hardNo.value;
    case "min_contract_months":
      // Fixed-term/temporary contracts below the worker's minimum are rejected.
      // The job doesn't carry a duration field in the MVP schema, so this only
      // applies to non-permanent contracts as a conservative guard.
      return job.contract !== "permanent" && typeof hardNo.value === "number";
    default:
      return false;
  }
}
