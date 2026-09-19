import { describe, expect, it } from "vitest";
import { emptyWeeklySchedule, type Job, type WorkerProfile } from "@werkwire/shared";
import { runMatching } from "../src/index";

function worker(id: string, overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id,
    user_id: `u-${id}`,
    display_alias: `Candidato #${id}`,
    headline: null,
    summary: null,
    years_experience: 4,
    location_point: { lat: 38.7, lng: -9.1 },
    location_label: "Amadora",
    max_commute_minutes: 45,
    commute_modes: ["transit"],
    salary_min: 1000,
    salary_ideal: 1200,
    accepted_contracts: ["permanent"],
    accepted_work_modes: ["onsite"],
    availability: "active",
    urgent: false,
    weekly_availability: {
      ...emptyWeeklySchedule(),
      mon: [{ from: "08:00", to: "17:00" }],
      tue: [{ from: "08:00", to: "17:00" }],
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

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    company_id: `c-${id}`,
    title: "Empregado de mesa",
    description: "",
    sector: "hospitality",
    salary_min: 1000,
    salary_max: 1300,
    contract: "permanent",
    work_mode: "onsite",
    location_point: { lat: 38.71, lng: -9.13 },
    location_label: "Alvalade",
    weekly_schedule: {
      ...emptyWeeklySchedule(),
      mon: [{ from: "09:00", to: "13:00" }],
      tue: [{ from: "09:00", to: "13:00" }],
    },
    has_nights: false,
    has_weekends: false,
    required_skills: [{ slug: "customer_service", label: "Atendimento", weight: "essential", min_years: 2 }],
    min_years_experience: 2,
    required_languages: [],
    required_licences: [],
    required_certs: [],
    requires_work_auth: true,
    positions_count: 1,
    fill_by_date: "2026-12-01",
    blocked_worker_ids: [],
    status: "active",
    reputation: { ghost_flag: false, verification_level: "full", response_rate_48h: 0.8 },
    ...overrides,
  };
}

describe("runMatching", () => {
  it("creates matches for compatible pairs and respects quotas", () => {
    const workers = [worker("w1"), worker("w2"), worker("w3")];
    const jobs = [job("j1"), job("j2")];

    const commuteMatrix = new Map<string, number>();
    const similarityMatrix = new Map<string, number>();
    for (const w of workers) {
      for (const j of jobs) {
        commuteMatrix.set(`${w.id}:${j.id}`, 15);
        similarityMatrix.set(`${w.id}:${j.id}`, 0.75);
      }
    }

    const result = runMatching({
      workers,
      jobs,
      commuteMatrix,
      similarityMatrix,
      existingPairs: new Set(),
      quotas: { workerDaily: 3, jobPerCycle: 5 },
      engineVersion: "1.0.0",
    });

    expect(result.stats.workersEvaluated).toBe(3);
    expect(result.stats.jobsEvaluated).toBe(2);
    expect(result.matches.length).toBeGreaterThan(0);
    for (const m of result.matches) {
      expect(m.explanationWorker).toContain("Match porque");
      expect(m.explanationEmployer).toContain("Match porque");
      expect(m.scoreBreakdown.fit_employer).toBeGreaterThanOrEqual(0.62);
      expect(m.scoreBreakdown.fit_worker).toBeGreaterThanOrEqual(0.62);
    }
  });

  it("never re-proposes an existing pair", () => {
    const w = worker("w1");
    const j = job("j1");
    const result = runMatching({
      workers: [w],
      jobs: [j],
      commuteMatrix: new Map([["w1:j1", 10]]),
      similarityMatrix: new Map([["w1:j1", 0.8]]),
      existingPairs: new Set(["w1:j1"]),
      quotas: { workerDaily: 3, jobPerCycle: 5 },
      engineVersion: "1.0.0",
    });
    expect(result.matches).toHaveLength(0);
  });

  it("skips pairs with no commute entry (outside retrieval radius)", () => {
    const w = worker("w1");
    const j = job("j1");
    const result = runMatching({
      workers: [w],
      jobs: [j],
      commuteMatrix: new Map(),
      similarityMatrix: new Map(),
      existingPairs: new Set(),
      quotas: { workerDaily: 3, jobPerCycle: 5 },
      engineVersion: "1.0.0",
    });
    expect(result.matches).toHaveLength(0);
    expect(result.stats.pairsScored).toBe(0);
  });

  it("ignores non-active jobs", () => {
    const w = worker("w1");
    const j = job("j1", { status: "paused" });
    const result = runMatching({
      workers: [w],
      jobs: [j],
      commuteMatrix: new Map([["w1:j1", 10]]),
      similarityMatrix: new Map([["w1:j1", 0.8]]),
      existingPairs: new Set(),
      quotas: { workerDaily: 3, jobPerCycle: 5 },
      engineVersion: "1.0.0",
    });
    expect(result.stats.jobsEvaluated).toBe(0);
    expect(result.matches).toHaveLength(0);
  });
});
