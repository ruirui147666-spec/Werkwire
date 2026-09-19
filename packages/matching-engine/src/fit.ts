import type { AdjacencyMap, Job, ScoreBreakdown, ScoreComponent, WorkerProfile } from "@werkwire/shared";
import { evaluateKnockouts, type KnockoutResult } from "./knockout.js";
import { harmonic } from "./reciprocal.js";
import { scoreCommute } from "./soft/commute.js";
import { scoreContract } from "./soft/contract.js";
import { scoreEmployerReputation } from "./soft/employerReputation.js";
import { scoreExperience } from "./soft/experience.js";
import { scoreLanguages } from "./soft/languages.js";
import { scoreSalary } from "./soft/salary.js";
import { scoreSchedule } from "./soft/schedule.js";
import { scoreSemantic } from "./soft/semantic.js";
import { scoreSkills } from "./soft/skills.js";
import { scoreWorkMode } from "./soft/workMode.js";
import type { WeightSet } from "./weights/index.js";

export interface ScoringContext {
  commuteMinutes: number;
  commuteEstimated?: boolean;
  cosineSimilarity: number;
  adjacency?: AdjacencyMap;
}

export interface FitResult {
  knockout: KnockoutResult;
  fitEmployer: number;
  fitWorker: number;
  harmonicScore: number;
  breakdown: Omit<ScoreBreakdown, "context" | "priority" | "engine_version" | "weights_version">;
}

function component(raw: number, weight: number): ScoreComponent {
  return { raw, weight, contribution: raw * weight };
}

export function computeFit(
  worker: WorkerProfile,
  job: Job,
  ctx: ScoringContext,
  weights: WeightSet
): FitResult {
  const knockout = evaluateKnockouts(worker, job, { commuteMinutes: ctx.commuteMinutes });

  const skills = scoreSkills(worker.skills, job.required_skills, ctx.adjacency ?? {});
  const experience = scoreExperience(worker.years_experience, job.min_years_experience);
  const languages = scoreLanguages(worker.languages, job.required_languages);
  const schedule = scoreSchedule(worker.weekly_availability, job.weekly_schedule);
  const commute = scoreCommute(ctx.commuteMinutes, worker.max_commute_minutes);
  const semantic = scoreSemantic(ctx.cosineSimilarity);

  const salary = scoreSalary(worker.salary_min, worker.salary_ideal, job.salary_min, job.salary_max);
  const contract = scoreContract(worker.accepted_contracts, job.contract);
  const workMode = scoreWorkMode(worker.accepted_work_modes, job.work_mode);
  const employerReputation = scoreEmployerReputation(
    job.reputation ?? { ghost_flag: false, verification_level: "none" }
  );

  const softEmployer = {
    skills: component(skills, weights.employer.skills),
    experience: component(experience, weights.employer.experience),
    languages: component(languages, weights.employer.languages),
    schedule: component(schedule, weights.employer.schedule),
    commute: component(commute, weights.employer.commute),
    semantic: component(semantic, weights.employer.semantic),
  };

  const softWorker = {
    salary: component(salary, weights.worker.salary),
    commute: component(commute, weights.worker.commute),
    schedule: component(schedule, weights.worker.schedule),
    contract: component(contract, weights.worker.contract),
    work_mode: component(workMode, weights.worker.work_mode),
    employer_reputation: component(employerReputation, weights.worker.employer_reputation),
  };

  const fitEmployer = knockout.passed
    ? Object.values(softEmployer).reduce((s, c) => s + c.contribution, 0)
    : 0;
  const fitWorker = knockout.passed
    ? Object.values(softWorker).reduce((s, c) => s + c.contribution, 0)
    : 0;

  const harmonicScore = harmonic(fitEmployer, fitWorker);

  return {
    knockout,
    fitEmployer,
    fitWorker,
    harmonicScore,
    breakdown: {
      knockouts: Object.fromEntries(
        ["blocked_worker", "blocked_company", "blocked_sector", "worker_unavailable", "job_not_active", "work_authorisation", "min_age", "required_licences", "required_certs", "nights", "weekends", "max_commute", "work_mode", "contract_type"].map(
          (key) => [key, !knockout.failed.includes(key)]
        )
      ),
      soft_employer: softEmployer,
      soft_worker: softWorker,
      fit_employer: round4(fitEmployer),
      fit_worker: round4(fitWorker),
      harmonic: round4(harmonicScore),
      commute_minutes: ctx.commuteMinutes,
      commute_estimated: ctx.commuteEstimated ?? false,
    },
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
