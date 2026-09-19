import { z } from "zod";
import { CONTRACT_TYPES, JOB_STATUS, WORK_MODES } from "./enums";
import { geoPointSchema } from "./geo";
import { weeklyScheduleSchema } from "./schedule";
import { requiredLanguageSchema, requiredSkillSchema } from "./skills";

export const companyReputationSchema = z.object({
  response_rate_48h: z.number().min(0).max(1).nullable().optional(),
  hire_rate: z.number().min(0).max(1).nullable().optional(),
  abandon_rate: z.number().min(0).max(1).nullable().optional(),
  ghost_flag: z.boolean().default(false),
  verification_level: z.enum(["none", "phone", "email", "identity", "full"]).default("none"),
});
export type CompanyReputation = z.infer<typeof companyReputationSchema>;

export const jobSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),

  title: z.string(),
  description: z.string(),
  sector: z.string(),

  salary_min: z.number().int().nonnegative(),
  salary_max: z.number().int().nonnegative(),
  contract: z.enum(CONTRACT_TYPES),
  work_mode: z.enum(WORK_MODES),
  location_point: geoPointSchema,
  location_label: z.string(),
  weekly_schedule: weeklyScheduleSchema,
  has_nights: z.boolean().default(false),
  has_weekends: z.boolean().default(false),

  required_skills: z.array(requiredSkillSchema),
  min_years_experience: z.number().min(0).default(0),
  required_languages: z.array(requiredLanguageSchema).default([]),
  required_licences: z.array(z.string()).default([]),
  required_certs: z.array(z.string()).default([]),
  requires_work_auth: z.boolean().default(true),
  min_age: z.number().int().positive().nullable().optional(),

  positions_count: z.number().int().positive().default(1),
  fill_by_date: z.string(),

  blocked_worker_ids: z.array(z.string().uuid()).default([]),

  status: z.enum(JOB_STATUS).default("draft"),

  embedding: z.array(z.number()).nullable().optional(),
  published_at: z.string().nullable().optional(),

  reputation: companyReputationSchema.optional(),
});
export type Job = z.infer<typeof jobSchema>;
