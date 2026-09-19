import { WEEKDAYS, type WeeklySchedule } from "@werkwire/shared";

function overlapMinutes(a: { from: string; to: string }, b: { from: string; to: string }): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const start = Math.max(toMin(a.from), toMin(b.from));
  const end = Math.min(toMin(a.to), toMin(b.to));
  return Math.max(0, end - start);
}

/** Fraction of the job's required weekly minutes that the worker's availability covers. */
export function scoreSchedule(workerAvailability: WeeklySchedule, jobSchedule: WeeklySchedule): number {
  let totalJobMinutes = 0;
  let coveredMinutes = 0;

  for (const day of WEEKDAYS) {
    for (const jobSlot of jobSchedule[day]) {
      const jobMin = (() => {
        const [fh, fm] = jobSlot.from.split(":").map(Number);
        const [th, tm] = jobSlot.to.split(":").map(Number);
        return th * 60 + tm - (fh * 60 + fm);
      })();
      totalJobMinutes += jobMin;

      for (const workerSlot of workerAvailability[day]) {
        coveredMinutes += overlapMinutes(jobSlot, workerSlot);
      }
    }
  }

  if (totalJobMinutes === 0) return 1.0;
  return Math.min(1, coveredMinutes / totalJobMinutes);
}
