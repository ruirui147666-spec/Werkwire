import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  EMBEDDING_PROVIDER: z.enum(["local", "groq"]).default("local"),
  EMBEDDING_DIMS: z.coerce.number().int().positive().default(1024),
  MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.62),
  WORKER_DAILY_QUOTA: z.coerce.number().int().positive().default(3),
  JOB_CYCLE_QUOTA: z.coerce.number().int().positive().default(5),
  MATCH_EXPIRY_HOURS: z.coerce.number().int().positive().default(48),
  ENGINE_VERSION: z.string().default("1.0.0"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CYCLE_TRIGGER_SECRET: z.string().default("change-me-in-production"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

// Client-safe values only — never import `serverEnv` from a "use client" file.
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
  EMBEDDING_DIMS: process.env.EMBEDDING_DIMS,
  MATCH_THRESHOLD: process.env.MATCH_THRESHOLD,
  WORKER_DAILY_QUOTA: process.env.WORKER_DAILY_QUOTA,
  JOB_CYCLE_QUOTA: process.env.JOB_CYCLE_QUOTA,
  MATCH_EXPIRY_HOURS: process.env.MATCH_EXPIRY_HOURS,
  ENGINE_VERSION: process.env.ENGINE_VERSION,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  CYCLE_TRIGGER_SECRET: process.env.CYCLE_TRIGGER_SECRET,
});
