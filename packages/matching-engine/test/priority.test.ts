import { describe, expect, it } from "vitest";
import { computeCongestionDivisor, computeFreshness, computePriority } from "../src/priority";

describe("computePriority", () => {
  it("combines harmonic score with response/accept probabilities, freshness and congestion", () => {
    const priority = computePriority(0.8, {
      pEmployerResponds: 0.8,
      pWorkerAccepts: 0.5,
      congestionDivisor: 1,
      freshness: 1,
    });
    expect(priority).toBeCloseTo(0.32, 5);
  });

  it("guards against a zero/negative congestion divisor", () => {
    const priority = computePriority(0.8, {
      pEmployerResponds: 1,
      pWorkerAccepts: 1,
      congestionDivisor: 0,
      freshness: 1,
    });
    expect(priority).toBeCloseTo(0.8, 5);
  });
});

describe("computeFreshness", () => {
  it("decays with age but never below the 0.3 floor", () => {
    expect(computeFreshness(0)).toBeCloseTo(1, 5);
    expect(computeFreshness(365)).toBeGreaterThanOrEqual(0.3);
    expect(computeFreshness(365)).toBeCloseTo(0.3, 5);
  });
});

describe("computeCongestionDivisor", () => {
  it("grows with the number of active matches on the job", () => {
    expect(computeCongestionDivisor(0)).toBe(1);
    expect(computeCongestionDivisor(3)).toBe(2);
  });
});
