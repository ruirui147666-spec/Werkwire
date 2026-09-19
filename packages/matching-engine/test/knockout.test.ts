import { describe, expect, it } from "vitest";
import { emptyWeeklySchedule, type Job, type WorkerProfile } from "@werkwire/shared";
import { evaluateKnockouts } from "../src/knockout.js";

function makeWorker(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: "w1",
    user_id: "u1",
    display_alias: "Candidato #A1",
    headline: null,
    summary: null,
    years_experience: 2,
    location_point: { lat: 38.7, lng: -9.1 },
    location_label: "Lisboa",
    max_commute_minutes: 45,
    commute_modes: ["transit"],
    salary_min: 900,
    salary_ideal: 1000,
    accepted_contracts: ["permanent"],
    accepted_work_modes: ["onsite"],
    availability: "active",
    urgent: false,
    weekly_availability: emptyWeeklySchedule(),
    accepts_nights: false,
    accepts_weekends: false,
    skills: [],
    languages: [],
    licences: [],
    certifications: [],
    work_authorisation: "eu",
    min_age_ok: true,
    blocked_company_ids: [],
    blocked_sectors: [],
    hard_nos: [],
    verification_level: "none",
    trust_score: 0.5,
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
    salary_min: 900,
    salary_max: 1200,
    contract: "permanent",
    work_mode: "onsite",
    location_point: { lat: 38.71, lng: -9.13 },
    location_label: "Lisboa",
    weekly_schedule: emptyWeeklySchedule(),
    has_nights: false,
    has_weekends: false,
    required_skills: [],
    min_years_experience: 0,
    required_languages: [],
    required_licences: [],
    required_certs: [],
    requires_work_auth: true,
    positions_count: 1,
    fill_by_date: "2026-12-01",
    blocked_worker_ids: [],
    status: "active",
    ...overrides,
  };
}

describe("evaluateKnockouts", () => {
  it("fails when a required licence is missing", () => {
    const worker = makeWorker({ licences: [] });
    const job = makeJob({ required_licences: ["forklift"] });
    const result = evaluateKnockouts(worker, job, { commuteMinutes: 10 });
    expect(result.passed).toBe(false);
    expect(result.failed).toContain("required_licences");
  });

  it("fails hard_no 'no_sundays' against a job that requires Sundays", () => {
    const worker = makeWorker({ hard_nos: [{ type: "no_sundays" }] });
    const job = makeJob({ weekly_schedule: { ...emptyWeeklySchedule(), sun: [{ from: "10:00", to: "14:00" }] } });
    const result = evaluateKnockouts(worker, job, { commuteMinutes: 10 });
    expect(result.passed).toBe(false);
    expect(result.failed).toContain("hard_no:no_sundays");
  });

  it("passes a fully compatible pair", () => {
    const worker = makeWorker();
    const job = makeJob();
    const result = evaluateKnockouts(worker, job, { commuteMinutes: 10 });
    expect(result.passed).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it("fails when commute exceeds the worker's maximum", () => {
    const worker = makeWorker({ max_commute_minutes: 30 });
    const job = makeJob();
    const result = evaluateKnockouts(worker, job, { commuteMinutes: 45 });
    expect(result.failed).toContain("max_commute");
  });
});
