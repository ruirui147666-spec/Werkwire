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

describe("evaluateKnockouts — remaining branches", () => {
  it("fails when the job explicitly blocks this worker", () => {
    const r = evaluateKnockouts(makeWorker(), makeJob({ blocked_worker_ids: ["w1"] }), { commuteMinutes: 10 });
    expect(r.failed).toContain("blocked_worker");
  });

  it("fails when the worker blocked this company", () => {
    const r = evaluateKnockouts(makeWorker({ blocked_company_ids: ["c1"] }), makeJob(), { commuteMinutes: 10 });
    expect(r.failed).toContain("blocked_company");
  });

  it("fails when the worker blocked this sector", () => {
    const r = evaluateKnockouts(makeWorker({ blocked_sectors: ["hospitality"] }), makeJob(), { commuteMinutes: 10 });
    expect(r.failed).toContain("blocked_sector");
  });

  it("fails when the worker is unavailable", () => {
    const r = evaluateKnockouts(makeWorker({ availability: "unavailable" }), makeJob(), { commuteMinutes: 10 });
    expect(r.failed).toContain("worker_unavailable");
  });

  it("fails when the job isn't active", () => {
    const r = evaluateKnockouts(makeWorker(), makeJob({ status: "paused" }), { commuteMinutes: 10 });
    expect(r.failed).toContain("job_not_active");
  });

  it("fails when work authorisation is required and missing", () => {
    const r = evaluateKnockouts(makeWorker({ work_authorisation: "none" }), makeJob(), { commuteMinutes: 10 });
    expect(r.failed).toContain("work_authorisation");
  });

  it("passes work authorisation for a residence permit holder", () => {
    const r = evaluateKnockouts(makeWorker({ work_authorisation: "residence_permit" }), makeJob(), { commuteMinutes: 10 });
    expect(r.failed).not.toContain("work_authorisation");
  });

  it("fails on min_age when the worker doesn't meet it", () => {
    const r = evaluateKnockouts(makeWorker({ min_age_ok: false }), makeJob({ min_age: 18 }), { commuteMinutes: 10 });
    expect(r.failed).toContain("min_age");
  });

  it("fails when a required certification is missing", () => {
    const r = evaluateKnockouts(makeWorker({ certifications: [] }), makeJob({ required_certs: ["haccp"] }), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("required_certs");
  });

  it("fails when the job has weekend shifts and the worker doesn't accept them", () => {
    const r = evaluateKnockouts(makeWorker({ accepts_weekends: false }), makeJob({ has_weekends: true }), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("weekends");
  });

  it("fails when the work mode isn't among the worker's accepted modes", () => {
    const r = evaluateKnockouts(makeWorker({ accepted_work_modes: ["remote"] }), makeJob({ work_mode: "onsite" }), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("work_mode");
  });

  it("fails when the contract type isn't among the worker's accepted contracts", () => {
    const r = evaluateKnockouts(makeWorker({ accepted_contracts: ["freelance"] }), makeJob({ contract: "permanent" }), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("contract_type");
  });

  it("fails hard_no 'no_freelance' against a freelance job", () => {
    const r = evaluateKnockouts(
      makeWorker({ hard_nos: [{ type: "no_freelance" }], accepted_contracts: ["freelance"] }),
      makeJob({ contract: "freelance" }),
      { commuteMinutes: 10 }
    );
    expect(r.failed).toContain("hard_no:no_freelance");
  });

  it("fails hard_no 'no_night_shifts' against a job with night shifts", () => {
    const r = evaluateKnockouts(
      makeWorker({ hard_nos: [{ type: "no_night_shifts" }], accepts_nights: true }),
      makeJob({ has_nights: true }),
      { commuteMinutes: 10 }
    );
    expect(r.failed).toContain("hard_no:no_night_shifts");
  });

  it("fails hard_no 'no_sector' against a matching sector", () => {
    const r = evaluateKnockouts(makeWorker({ hard_nos: [{ type: "no_sector", value: "hospitality" }] }), makeJob(), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("hard_no:no_sector");
  });

  it("fails a required language the worker doesn't have at all", () => {
    const r = evaluateKnockouts(makeWorker({ languages: [] }), makeJob({ required_languages: [{ code: "en", min_level: "basic" }] }), {
      commuteMinutes: 10,
    });
    expect(r.failed).toContain("language:en");
  });

  it("passes a required language the worker has at a sufficient level", () => {
    const r = evaluateKnockouts(
      makeWorker({ languages: [{ code: "en", level: "advanced" }] }),
      makeJob({ required_languages: [{ code: "en", min_level: "basic" }] }),
      { commuteMinutes: 10 }
    );
    expect(r.failed).not.toContain("language:en");
  });
});
