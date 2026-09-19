export interface PriorityContext {
  pEmployerResponds: number;
  pWorkerAccepts: number;
  congestionDivisor: number;
  freshness: number;
}

export function computePriority(harmonicScore: number, ctx: PriorityContext): number {
  const divisor = ctx.congestionDivisor > 0 ? ctx.congestionDivisor : 1;
  return (harmonicScore * ctx.pEmployerResponds * ctx.pWorkerAccepts * ctx.freshness) / divisor;
}

/** exp(-days/30), floored at 0.3 so old-but-good postings/profiles don't vanish entirely. */
export function computeFreshness(daysSincePublished: number): number {
  return Math.max(0.3, Math.exp(-daysSincePublished / 30));
}

export function computeCongestionDivisor(activeMatchesForJob: number): number {
  return 1 + activeMatchesForJob / 3;
}
