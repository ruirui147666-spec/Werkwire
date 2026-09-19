export const THRESHOLD = 0.62;

/** Harmonic mean — punishes asymmetric fits far more than an arithmetic mean would. */
export function harmonic(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return (2 * a * b) / (a + b);
}

export function isMatch(fitEmployer: number, fitWorker: number, threshold = THRESHOLD): boolean {
  return (
    fitEmployer >= threshold &&
    fitWorker >= threshold &&
    harmonic(fitEmployer, fitWorker) >= threshold
  );
}
