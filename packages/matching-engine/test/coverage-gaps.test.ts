import { describe, expect, it } from "vitest";
import { emptyWeeklySchedule, type Job, type WorkerProfile } from "@werkwire/shared";
import { scoreCommute } from "../src/soft/commute.js";
import { scoreSalary } from "../src/soft/salary.js";
import { scoreSkills } from "../src/soft/skills.js";
import { evaluateKnockouts } from "../src/knockout.js";
import { runMatching } from "../src/index.js";

describe("coverage gaps", () => {
  it("scoreCommute guards against a zero max", () => {
    expect(scoreCommute(10, 0)).toBe(0);
  });

  it("scoreSalary computes a partial overlap when the worker has no ideal salary", () => {
    const score = scoreSalary(1000, null, 900, 1400);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("scoreSkills matches via the adjacency table when there's no exact slug match", () => {
    const score = scoreSkills(
      [{ slug: "warehouse_operator", label: "Armazém", years: 3, verified: false }],
      [{ slug: "forklift", label: "Empilhador", weight: "essential", min_years: 0 }],
      { forklift: { warehouse_operator: 0.6 } }
    );
    expect(score).toBeCloseTo(0.6, 5);
  });

  it("evaluateKnockouts applies min_contract_months only to non-permanent contracts", () => {
    const worker: WorkerProfile = {
      id: "w1",
      user_id: "u1",
      display_alias: "A1",
      headline: null,
      summary: null,
      years_experience: 1,
      location_point: { lat: 38.7, lng: -9.1 },
      location_label: "Lisboa",
      max_commute_minutes: 45,
      commute_modes: ["transit"],
      salary_min: 900,
      salary_ideal: null,
      accepted_contracts: ["fixed_term"],
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
      hard_nos: [{ type: "min_contract_months", value: 6 }],
      verification_level: "none",
      trust_score: 0.5,
    };
    const job: Job = {
      id: "j1",
      company_id: "c1",
      title: "x",
      description: "",
      sector: "retail",
      salary_min: 900,
      salary_max: 1000,
      contract: "fixed_term",
      work_mode: "onsite",
      location_point: { lat: 38.7, lng: -9.1 },
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
    };

    const failing = evaluateKnockouts(worker, job, { commuteMinutes: 10 });
    expect(failing.failed).toContain("hard_no:min_contract_months");

    const permanentJob = { ...job, contract: "permanent" as const };
    const passing = evaluateKnockouts(worker, { ...permanentJob, contract: "fixed_term" }, { commuteMinutes: 10 });
    expect(passing.failed).toContain("hard_no:min_contract_months");
  });

  it("runMatching honours optional context maps (segment, congestion, freshness, priors, adjacency)", () => {
    const worker: WorkerProfile = {
      id: "w1",
      user_id: "u1",
      display_alias: "A1",
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
      weekly_availability: { ...emptyWeeklySchedule(), mon: [{ from: "08:00", to: "17:00" }] },
      accepts_nights: false,
      accepts_weekends: false,
      skills: [{ slug: "customer_service", label: "x", years: 4, verified: true }],
      languages: [],
      licences: [],
      certifications: [],
      work_authorisation: "eu",
      min_age_ok: true,
      blocked_company_ids: [],
      blocked_sectors: [],
      hard_nos: [],
      verification_level: "full",
      trust_score: 0.7,
    };
    const job: Job = {
      id: "j1",
      company_id: "c1",
      title: "x",
      description: "",
      sector: "hospitality",
      salary_min: 1000,
      salary_max: 1300,
      contract: "permanent",
      work_mode: "onsite",
      location_point: { lat: 38.71, lng: -9.13 },
      location_label: "Lisboa",
      weekly_schedule: { ...emptyWeeklySchedule(), mon: [{ from: "09:00", to: "13:00" }] },
      has_nights: false,
      has_weekends: false,
      required_skills: [{ slug: "customer_service", label: "x", weight: "essential", min_years: 2 }],
      min_years_experience: 2,
      required_languages: [],
      required_licences: [],
      required_certs: [],
      requires_work_auth: true,
      positions_count: 1,
      fill_by_date: "2026-12-01",
      blocked_worker_ids: [],
      status: "active",
    };

    const result = runMatching({
      workers: [worker],
      jobs: [job],
      companySegmentByJobId: new Map([["j1", "hospitality"]]),
      commuteMatrix: new Map([["w1:j1", 12]]),
      commuteEstimated: new Map([["w1:j1", true]]),
      similarityMatrix: new Map([["w1:j1", 0.8]]),
      adjacency: {},
      existingPairs: new Set(),
      quotas: { workerDaily: 3, jobPerCycle: 5 },
      engineVersion: "1.0.0",
      activeMatchesPerJob: new Map([["j1", 2]]),
      jobAgeDays: new Map([["j1", 10]]),
      employerResponseProbability: new Map([["c1", 0.9]]),
      workerAcceptProbability: new Map([["w1", 0.7]]),
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].weightsVersion).toBe("hospitality-v1");
    expect(result.matches[0].scoreBreakdown.commute_estimated).toBe(true);
  });
});
