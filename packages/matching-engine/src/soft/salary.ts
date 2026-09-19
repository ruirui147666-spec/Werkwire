export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Overlap between what the job pays and what the worker needs/wants.
 * Returns 0 when the job can't even meet the worker's minimum.
 */
export function scoreSalary(
  workerMin: number,
  workerIdeal: number | null | undefined,
  jobMin: number,
  jobMax: number
): number {
  if (jobMax < workerMin) return 0;

  if (workerIdeal != null && jobMin >= workerIdeal) return 1.0;

  const overlapCeiling = Math.min(jobMax, workerIdeal ?? jobMax);
  const overlapFloor = Math.max(jobMin, workerMin);
  const overlap = Math.max(0, overlapCeiling - overlapFloor);

  const range = workerIdeal ? workerIdeal - workerMin : jobMax - jobMin;

  return clamp(overlap / Math.max(range, 1), 0, 1);
}
