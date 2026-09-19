import { describe, expect, it } from "vitest";
import { harmonic, isMatch } from "../src/reciprocal";

describe("harmonic", () => {
  it("kills asymmetric matches", () => {
    expect(harmonic(0.95, 0.35)).toBeLessThan(0.55);
  });

  it("equals the shared value when both sides agree", () => {
    expect(harmonic(0.8, 0.8)).toBeCloseTo(0.8, 5);
  });

  it("returns 0 if either side is non-positive", () => {
    expect(harmonic(0, 0.9)).toBe(0);
    expect(harmonic(0.9, 0)).toBe(0);
  });
});

describe("isMatch", () => {
  it("enforces the double threshold — one high side is not enough", () => {
    expect(isMatch(0.95, 0.4)).toBe(false);
  });

  it("passes when both sides and the harmonic mean clear the bar", () => {
    expect(isMatch(0.7, 0.7)).toBe(true);
  });
});
