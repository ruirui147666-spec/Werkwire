import { describe, expect, it } from "vitest";
import { emptyWeeklySchedule, type Job, type WorkerProfile } from "@werkwire/shared";
import { computeFit } from "../src/fit.js";
import { explainForEmployer, explainForWorker, explainNoMatches } from "../src/explain.js";
import { getWeights } from "../src/weights/index.js";

function makeWorker(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: "w1",
    user_id: "u1",
    display_alias: "Candidato #A1",
    headline: null,
    summary: null,
    years_experience: 4,
    location_point: { lat: 38.7, lng: -9.1 },
    location_label: "Amadora, Lisboa",
    max_commute_minutes: 45,
    commute_modes: ["transit"],
    salary_min: 1150,
    salary_ideal: 1300,
    accepted_contracts: ["permanent"],
    accepted_work_modes: ["onsite"],
    availability: "active",
    urgent: false,
    weekly_availability: {
      ...emptyWeeklySchedule(),
      mon: [{ from: "08:00", to: "17:00" }],
    },
    accepts_nights: false,
    accepts_weekends: false,
    skills: [{ slug: "customer_service", label: "Atendimento", years: 4, verified: true }],
    languages: [{ code: "pt", level: "native" }],
    licences: [],
    certifications: [],
    work_authorisation: "eu",
    min_age_ok: true,
    blocked_company_ids: [],
    blocked_sectors: [],
    hard_nos: [],
    verification_level: "full",
    trust_score: 0.7,
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    company_id: "c1",
    title: "Empregado de mesa",
    description: "",
    sector: "hospitality",
    salary_min: 1150,
    salary_max: 1300,
    contract: "permanent",
    work_mode: "onsite",
    location_point: { lat: 38.71, lng: -9.13 },
    location_label: "Alvalade, Lisboa",
    weekly_schedule: {
      ...emptyWeeklySchedule(),
      mon: [{ from: "09:00", to: "13:00" }],
    },
    has_nights: false,
    has_weekends: false,
    required_skills: [{ slug: "customer_service", label: "Atendimento", weight: "essential", min_years: 2 }],
    min_years_experience: 3,
    required_languages: [],
    required_licences: [],
    required_certs: [],
    requires_work_auth: true,
    positions_count: 1,
    fill_by_date: "2026-12-01",
    blocked_worker_ids: [],
    status: "active",
    reputation: { ghost_flag: false, verification_level: "full", response_rate_48h: 0.82 },
    ...overrides,
  };
}

describe("explanations", () => {
  it("produces a non-empty, grounded explanation for the worker", () => {
    const worker = makeWorker();
    const job = makeJob();
    const fit = computeFit(worker, job, { commuteMinutes: 18, cosineSimilarity: 0.71 }, getWeights("default"));
    const text = explainForWorker(
      { ...fit.breakdown, context: { p_employer_responds: 0.8, p_worker_accepts: 0.5, congestion_divisor: 1, freshness: 1 }, priority: 0.3, engine_version: "1.0.0", weights_version: "default-v1" },
      job
    );
    expect(text).toContain("Match porque");
    expect(text.length).toBeGreaterThan(10);
  });

  it("produces a non-empty, grounded explanation for the employer", () => {
    const worker = makeWorker();
    const job = makeJob();
    const fit = computeFit(worker, job, { commuteMinutes: 18, cosineSimilarity: 0.71 }, getWeights("default"));
    const text = explainForEmployer(
      { ...fit.breakdown, context: { p_employer_responds: 0.8, p_worker_accepts: 0.5, congestion_divisor: 1, freshness: 1 }, priority: 0.3, engine_version: "1.0.0", weights_version: "default-v1" },
      worker
    );
    expect(text).toContain("Match porque");
    expect(text).toMatch(/%|anos|min|línguas|alinhado/);
  });

  it("explains a negative case (salary above zone median) with a concrete suggestion", () => {
    const worker = makeWorker({ salary_min: 1300 });
    const text = explainNoMatches(worker, 1100, 7);
    expect(text).toContain("7 vagas compatíveis");
  });

  it("gives a generic message when salary isn't the blocker", () => {
    const worker = makeWorker({ salary_min: 900 });
    const text = explainNoMatches(worker, 1100, 7);
    expect(text).not.toContain("vagas compatíveis");
  });
});
