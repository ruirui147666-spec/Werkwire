import { describe, expect, it } from "vitest";
import { emptyWeeklySchedule, type Job, type WorkerProfile } from "@werkwire/shared";
import { computeFit } from "../src/fit.js";
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
    location_label: "Lisboa",
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
      wed: [{ from: "08:00", to: "17:00" }],
      thu: [{ from: "08:00", to: "17:00" }],
      fri: [{ from: "08:00", to: "17:00" }],
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
    location_label: "Lisboa",
    weekly_schedule: {
      ...emptyWeeklySchedule(),
      mon: [{ from: "09:00", to: "17:00" }],
      tue: [{ from: "09:00", to: "17:00" }],
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

describe("computeFit / score_breakdown reproducibility", () => {
  it("breakdown.fit_employer / fit_worker exactly match the returned fitEmployer / fitWorker", () => {
    const result = computeFit(
      makeWorker(),
      makeJob(),
      { commuteMinutes: 18, cosineSimilarity: 0.71 },
      getWeights("default")
    );

    expect(result.breakdown.fit_employer).toBeCloseTo(result.fitEmployer, 4);
    expect(result.breakdown.fit_worker).toBeCloseTo(result.fitWorker, 4);
    expect(result.breakdown.harmonic).toBeCloseTo(result.harmonicScore, 4);
  });

  it("scores 0 on both sides when a knockout fails", () => {
    const result = computeFit(
      makeWorker({ work_authorisation: "none" }),
      makeJob(),
      { commuteMinutes: 18, cosineSimilarity: 0.71 },
      getWeights("default")
    );
    expect(result.knockout.passed).toBe(false);
    expect(result.fitEmployer).toBe(0);
    expect(result.fitWorker).toBe(0);
  });
});
