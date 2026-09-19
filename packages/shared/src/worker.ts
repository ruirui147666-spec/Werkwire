import { z } from "zod";
import {
  AVAILABILITY,
  CONTRACT_TYPES,
  VERIFICATION_LEVELS,
  WORK_MODES,
} from "./enums.js";
import { geoPointSchema } from "./geo.js";
import { weeklyScheduleSchema } from "./schedule.js";
import { hardNoSchema, workerLanguageSchema, workerSkillSchema } from "./skills.js";

export const workAuthorisationSchema = z.enum([
  "eu",
  "residence_permit",
  "pending",
  "none",
]);
export type WorkAuthorisation = z.infer<typeof workAuthorisationSchema>;

export const workerProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),

  display_alias: z.string(),
  photo_url: z.string().nullable().optional(),

  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  years_experience: z.number().min(0).default(0),

  location_point: geoPointSchema,
  location_label: z.string(),
  max_commute_minutes: z.number().int().positive().default(45),
  commute_modes: z.array(z.enum(["transit", "car", "walk", "bike"])).default(["transit", "car"]),

  salary_min: z.number().int().nonnegative(),
  salary_ideal: z.number().int().nonnegative().nullable().optional(),
  accepted_contracts: z.array(z.enum(CONTRACT_TYPES)).min(1),
  accepted_work_modes: z.array(z.enum(WORK_MODES)).min(1),

  availability: z.enum(AVAILABILITY).default("active"),
  available_from: z.string().nullable().optional(),
  urgent: z.boolean().default(false),
  weekly_availability: weeklyScheduleSchema,
  accepts_nights: z.boolean().default(false),
  accepts_weekends: z.boolean().default(false),

  skills: z.array(workerSkillSchema).default([]),
  languages: z.array(workerLanguageSchema).default([]),
  licences: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  work_authorisation: workAuthorisationSchema,
  min_age_ok: z.boolean().default(true),

  blocked_company_ids: z.array(z.string().uuid()).default([]),
  blocked_sectors: z.array(z.string()).default([]),
  hard_nos: z.array(hardNoSchema).default([]),

  verification_level: z.enum(VERIFICATION_LEVELS).default("none"),
  response_rate: z.number().min(0).max(1).nullable().optional(),
  interview_show_rate: z.number().min(0).max(1).nullable().optional(),
  trust_score: z.number().min(0).max(1).default(0.5),

  embedding: z.array(z.number()).nullable().optional(),

  last_active_at: z.string().optional(),
});
export type WorkerProfile = z.infer<typeof workerProfileSchema>;
