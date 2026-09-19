import { z } from "zod";

export const workerSkillSchema = z.object({
  slug: z.string(),
  label: z.string(),
  years: z.number().min(0).default(0),
  verified: z.boolean().default(false),
});
export type WorkerSkill = z.infer<typeof workerSkillSchema>;

export const skillWeightSchema = z.enum(["essential", "desirable"]);
export type SkillWeight = z.infer<typeof skillWeightSchema>;

export const requiredSkillSchema = z.object({
  slug: z.string(),
  label: z.string(),
  weight: skillWeightSchema,
  min_years: z.number().min(0).default(0),
});
export type RequiredSkill = z.infer<typeof requiredSkillSchema>;

export const languageLevelSchema = z.enum(["basic", "intermediate", "advanced", "native"]);
export type LanguageLevel = z.infer<typeof languageLevelSchema>;

export const workerLanguageSchema = z.object({
  code: z.string(),
  level: languageLevelSchema,
});
export type WorkerLanguage = z.infer<typeof workerLanguageSchema>;

export const requiredLanguageSchema = z.object({
  code: z.string(),
  min_level: languageLevelSchema,
});
export type RequiredLanguage = z.infer<typeof requiredLanguageSchema>;

export const hardNoSchema = z.object({
  type: z.enum([
    "no_sundays",
    "no_freelance",
    "no_night_shifts",
    "no_sector",
    "min_contract_months",
  ]),
  value: z.union([z.string(), z.number()]).optional(),
});
export type HardNo = z.infer<typeof hardNoSchema>;

/** slugA -> slugB -> adjacency value in [0,1] used when there's no exact skill match. */
export type AdjacencyMap = Record<string, Record<string, number>>;
