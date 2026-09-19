import { describe, expect, it } from "vitest";
import { scoreSalary } from "../src/soft/salary";
import { scoreExperience } from "../src/soft/experience";
import { scoreCommute } from "../src/soft/commute";
import { scoreSchedule } from "../src/soft/schedule";
import { scoreSkills } from "../src/soft/skills";
import { emptyWeeklySchedule } from "@werkwire/shared";

describe("scoreSalary", () => {
  it("returns 0 when there is no overlap at all", () => {
    expect(scoreSalary(1200, null, 800, 1000)).toBe(0);
  });

  it("returns 1.0 when the offer is at or above the worker's ideal", () => {
    expect(scoreSalary(1000, 1200, 1200, 1500)).toBe(1.0);
  });
});

describe("scoreExperience", () => {
  it("never drops to 0 for 4 years against a 5-year requirement", () => {
    const score = scoreExperience(4, 5);
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  it("returns 1.0 when minYears is 0", () => {
    expect(scoreExperience(0, 0)).toBe(1.0);
  });

  it("returns 1.0 when worker meets or exceeds the requirement", () => {
    expect(scoreExperience(6, 5)).toBe(1.0);
  });
});

describe("scoreCommute", () => {
  it("returns 0 when minutes equals the maximum", () => {
    expect(scoreCommute(45, 45)).toBe(0);
  });

  it("returns 1 for zero minutes", () => {
    expect(scoreCommute(0, 45)).toBe(1);
  });
});

describe("scoreSchedule", () => {
  it("returns an exact proportional score for partial overlap", () => {
    const worker = emptyWeeklySchedule();
    worker.mon = [{ from: "08:00", to: "12:00" }]; // 4h available

    const job = emptyWeeklySchedule();
    job.mon = [{ from: "08:00", to: "16:00" }]; // 8h required

    // covered 4h / required 8h = 0.5
    expect(scoreSchedule(worker, job)).toBeCloseTo(0.5, 5);
  });

  it("returns 1.0 for a job with no scheduled hours", () => {
    expect(scoreSchedule(emptyWeeklySchedule(), emptyWeeklySchedule())).toBe(1.0);
  });
});

describe("scoreSkills", () => {
  it("weighs essential skills three times more than desirable ones", () => {
    const score = scoreSkills(
      [{ slug: "customer_service", label: "x", years: 4, verified: false }],
      [
        { slug: "customer_service", label: "x", weight: "essential", min_years: 0 },
        { slug: "pos_systems", label: "y", weight: "desirable", min_years: 0 },
      ]
    );
    // essential matched fully (weight 3), desirable unmatched (weight 1) -> 3/4
    expect(score).toBeCloseTo(0.75, 5);
  });

  it("returns 1.0 when no skills are required", () => {
    expect(scoreSkills([], [])).toBe(1.0);
  });
});
