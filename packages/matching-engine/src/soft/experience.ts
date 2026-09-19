/** Smooth curve — never a hard cliff. 4 years against a 5-year requirement still scores >= 0.85. */
export function scoreExperience(workerYears: number, minYears: number): number {
  if (minYears === 0) return 1.0;

  const ratio = workerYears / minYears;

  if (ratio >= 1) return 1.0;
  if (ratio >= 0.7) return 0.8 + (ratio - 0.7) * 0.6667;
  if (ratio >= 0.4) return 0.5 + (ratio - 0.4) * 1.0;
  return ratio * 1.25;
}
