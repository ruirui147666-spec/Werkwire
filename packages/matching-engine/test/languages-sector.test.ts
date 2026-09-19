import { describe, expect, it } from "vitest";
import { scoreLanguages } from "../src/soft/languages.js";
import { scoreSector } from "../src/soft/sector.js";
import { scoreContract } from "../src/soft/contract.js";
import { scoreWorkMode } from "../src/soft/workMode.js";
import { scoreEmployerReputation } from "../src/soft/employerReputation.js";

describe("scoreLanguages", () => {
  it("returns 1.0 when no language is required", () => {
    expect(scoreLanguages([], [])).toBe(1.0);
  });

  it("returns 0 for a missing required language", () => {
    expect(scoreLanguages([{ code: "pt", level: "native" }], [{ code: "en", min_level: "basic" }])).toBe(0);
  });

  it("returns a partial score when the level is below what's required", () => {
    const score = scoreLanguages(
      [{ code: "en", level: "basic" }],
      [{ code: "en", min_level: "advanced" }]
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 1.0 when the level meets or exceeds what's required", () => {
    expect(scoreLanguages([{ code: "en", level: "native" }], [{ code: "en", min_level: "basic" }])).toBe(1.0);
  });
});

describe("scoreSector", () => {
  it("returns 0 for a blocked sector", () => {
    expect(scoreSector(["telemarketing"], "telemarketing")).toBe(0);
  });

  it("returns 1 for a sector that isn't blocked", () => {
    expect(scoreSector(["telemarketing"], "hospitality")).toBe(1);
  });
});

describe("scoreContract / scoreWorkMode", () => {
  it("returns 0 when the contract type isn't accepted", () => {
    expect(scoreContract(["permanent"], "freelance")).toBe(0);
  });

  it("returns 0 when the work mode isn't accepted", () => {
    expect(scoreWorkMode(["onsite"], "remote")).toBe(0);
  });
});

describe("scoreEmployerReputation", () => {
  it("scores a new company (no history) neutrally-positive at 0.6", () => {
    expect(scoreEmployerReputation({ ghost_flag: false, verification_level: "none" })).toBeCloseTo(0.6, 5);
  });

  it("heavily penalises a ghost-flagged company", () => {
    const score = scoreEmployerReputation({
      response_rate_48h: 0.9,
      ghost_flag: true,
      verification_level: "none",
    });
    expect(score).toBeCloseTo(0.27, 5);
  });

  it("gives a bonus for full verification", () => {
    const score = scoreEmployerReputation({
      response_rate_48h: 0.8,
      ghost_flag: false,
      verification_level: "full",
    });
    expect(score).toBeCloseTo(0.9, 5);
  });
});
