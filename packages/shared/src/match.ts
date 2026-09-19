import { z } from "zod";
import { DECLINE_REASONS, MATCH_STATUS } from "./enums";

export const scoreComponentSchema = z.object({
  raw: z.number(),
  weight: z.number(),
  contribution: z.number(),
});
export type ScoreComponent = z.infer<typeof scoreComponentSchema>;

export const scoreBreakdownSchema = z.object({
  knockouts: z.record(z.string(), z.boolean()),
  soft_employer: z.record(z.string(), scoreComponentSchema),
  soft_worker: z.record(z.string(), scoreComponentSchema),
  fit_employer: z.number(),
  fit_worker: z.number(),
  harmonic: z.number(),
  context: z.object({
    p_employer_responds: z.number(),
    p_worker_accepts: z.number(),
    congestion_divisor: z.number(),
    freshness: z.number(),
  }),
  priority: z.number(),
  commute_minutes: z.number(),
  commute_estimated: z.boolean().optional(),
  engine_version: z.string(),
  weights_version: z.string(),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const matchSchema = z.object({
  id: z.string().uuid(),
  worker_id: z.string().uuid(),
  job_id: z.string().uuid(),
  cycle_id: z.string().uuid(),

  fit_employer: z.number(),
  fit_worker: z.number(),
  harmonic_score: z.number(),
  priority_score: z.number(),

  score_breakdown: scoreBreakdownSchema,
  engine_version: z.string(),
  weights_version: z.string(),

  explanation_worker: z.string(),
  explanation_employer: z.string(),

  status: z.enum(MATCH_STATUS).default("pending"),
  worker_responded_at: z.string().nullable().optional(),
  employer_responded_at: z.string().nullable().optional(),
  worker_decline_reason: z.enum(DECLINE_REASONS).nullable().optional(),
  employer_decline_reason: z.enum(DECLINE_REASONS).nullable().optional(),
  decline_note: z.string().nullable().optional(),

  expires_at: z.string(),
  confirmed_at: z.string().nullable().optional(),

  contested: z.boolean().default(false),
  contested_at: z.string().nullable().optional(),
  contest_note: z.string().nullable().optional(),
});
export type Match = z.infer<typeof matchSchema>;

export const declineRequestSchema = z.object({
  reason: z.enum(DECLINE_REASONS),
  note: z.string().max(500).optional(),
});
export type DeclineRequest = z.infer<typeof declineRequestSchema>;
