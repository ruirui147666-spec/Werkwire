import type { RequiredLanguage, WorkerLanguage } from "@werkwire/shared";

const LEVEL_RANK: Record<string, number> = {
  basic: 1,
  intermediate: 2,
  advanced: 3,
  native: 4,
};

export function scoreLanguages(worker: WorkerLanguage[], required: RequiredLanguage[]): number {
  if (required.length === 0) return 1.0;

  let sum = 0;
  for (const req of required) {
    const have = worker.find((w) => w.code === req.code);
    if (!have) {
      sum += 0;
      continue;
    }
    const haveRank = LEVEL_RANK[have.level] ?? 0;
    const needRank = LEVEL_RANK[req.min_level] ?? 0;
    if (haveRank >= needRank) sum += 1.0;
    else sum += Math.max(0, haveRank / needRank);
  }
  return sum / required.length;
}
