import type { AdjacencyMap, RequiredSkill, WorkerSkill } from "@werkwire/shared";
import { clamp } from "./salary.js";

const WEIGHT_VALUE: Record<RequiredSkill["weight"], number> = {
  essential: 3,
  desirable: 1,
};

export function scoreSkills(
  workerSkills: WorkerSkill[],
  requiredSkills: RequiredSkill[],
  adjacency: AdjacencyMap = {}
): number {
  if (requiredSkills.length === 0) return 1.0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const req of requiredSkills) {
    const weight = WEIGHT_VALUE[req.weight];
    weightTotal += weight;

    const exact = workerSkills.find((s) => s.slug === req.slug);
    let value = 0;
    let matchedYears: number | undefined;
    let verified = false;

    if (exact) {
      value = 1.0;
      matchedYears = exact.years;
      verified = exact.verified;
    } else {
      const adjacentScores = workerSkills
        .map((s) => ({ skill: s, adj: adjacency[req.slug]?.[s.slug] ?? adjacency[s.slug]?.[req.slug] }))
        .filter((x) => x.adj != null)
        .sort((a, b) => (b.adj ?? 0) - (a.adj ?? 0));

      if (adjacentScores.length > 0) {
        value = adjacentScores[0].adj ?? 0;
        matchedYears = adjacentScores[0].skill.years;
        verified = adjacentScores[0].skill.verified;
      }
    }

    if (value > 0 && req.min_years > 0) {
      value *= clamp((matchedYears ?? 0) / req.min_years, 0, 1);
    }

    if (value > 0 && verified) {
      value = clamp(value * 1.1, 0, 1.0);
    }

    weightedSum += weight * value;
  }

  return weightTotal === 0 ? 1.0 : weightedSum / weightTotal;
}
