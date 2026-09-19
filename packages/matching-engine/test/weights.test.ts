import { describe, expect, it } from "vitest";
import { allWeightSets, getWeights } from "../src/weights/index.js";

describe("weight sets", () => {
  it("sums to 1.0 for every registered segment, both blocks", () => {
    for (const w of allWeightSets()) {
      const employerSum = Object.values(w.employer).reduce((a, b) => a + b, 0);
      const workerSum = Object.values(w.worker).reduce((a, b) => a + b, 0);
      expect(employerSum).toBeCloseTo(1.0, 6);
      expect(workerSum).toBeCloseTo(1.0, 6);
    }
  });

  it("falls back to default for an unknown segment", () => {
    const w = getWeights("unknown-segment");
    expect(w.segment).toBe("default");
  });
});
