import { z } from "zod";

export const employerWeightsSchema = z.object({
  skills: z.number(),
  experience: z.number(),
  languages: z.number(),
  schedule: z.number(),
  commute: z.number(),
  semantic: z.number(),
});
export type EmployerWeights = z.infer<typeof employerWeightsSchema>;

export const workerWeightsSchema = z.object({
  salary: z.number(),
  commute: z.number(),
  schedule: z.number(),
  contract: z.number(),
  work_mode: z.number(),
  employer_reputation: z.number(),
});
export type WorkerWeights = z.infer<typeof workerWeightsSchema>;

export const segmentWeightsSchema = z.object({
  employer: employerWeightsSchema,
  worker: workerWeightsSchema,
  threshold: z.number().min(0).max(1),
});
export type SegmentWeights = z.infer<typeof segmentWeightsSchema>;

function sumsToOne(values: number[]): boolean {
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) < 1e-6;
}

export function assertValidWeights(w: SegmentWeights): void {
  if (!sumsToOne(Object.values(w.employer))) {
    throw new Error("employer weights must sum to 1.0");
  }
  if (!sumsToOne(Object.values(w.worker))) {
    throw new Error("worker weights must sum to 1.0");
  }
}
