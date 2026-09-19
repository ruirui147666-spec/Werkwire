import type { SegmentWeights } from "@werkwire/shared";
import { assertValidWeights } from "@werkwire/shared";
import defaultWeights from "./default.json" with { type: "json" };
import hospitalityWeights from "./hospitality.json" with { type: "json" };

export interface WeightSet extends SegmentWeights {
  version: string;
  segment: string;
}

const REGISTRY: Record<string, WeightSet> = {
  default: defaultWeights as WeightSet,
  hospitality: hospitalityWeights as WeightSet,
};

export function getWeights(segment: string | undefined | null): WeightSet {
  const weights = (segment && REGISTRY[segment]) || REGISTRY.default;
  assertValidWeights(weights);
  return weights;
}

export function allWeightSets(): WeightSet[] {
  return Object.values(REGISTRY);
}
