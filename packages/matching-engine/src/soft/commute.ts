/** Decays slowly at first, fast near the worker's limit. */
export function scoreCommute(minutes: number, maxMinutes: number): number {
  if (maxMinutes <= 0) return 0;
  const ratio = Math.min(1, minutes / maxMinutes);
  return Math.max(0, 1 - Math.pow(ratio, 1.5));
}
