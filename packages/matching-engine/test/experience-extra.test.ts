import { describe, expect, it } from "vitest";
import { scoreExperience } from "../src/soft/experience";

describe("scoreExperience — full curve", () => {
  it("is continuous and monotonic across breakpoints", () => {
    const points = [0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.9, 1.0, 1.5].map((r) => scoreExperience(r * 5, 5));
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThanOrEqual(points[i - 1] - 1e-9);
    }
    expect(points[points.length - 1]).toBe(1.0);
  });

  it("scores low but non-negative for very little experience", () => {
    expect(scoreExperience(0, 5)).toBeCloseTo(0, 5);
    expect(scoreExperience(1, 5)).toBeGreaterThan(0);
  });
});
