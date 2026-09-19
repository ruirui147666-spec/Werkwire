import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ParticipantRole = "worker" | "employer";

/**
 * Confirms the calling user is one of the two sides of a CONFIRMED match,
 * and which side. Used by pipeline/hire-confirm routes, which write to
 * tables (pipeline_events, hires) that only have SELECT policies for
 * participants — mutations go through the service role after this check.
 */
export async function resolveParticipant(
  userSupabase: SupabaseClient,
  admin: SupabaseClient,
  matchId: string,
  userId: string
): Promise<ParticipantRole | null> {
  const { data: match } = await admin
    .from("matches")
    .select("id, status, worker_id, jobs!inner(company_id)")
    .eq("id", matchId)
    .single();

  if (!match || match.status !== "confirmed") return null;

  const { data: worker } = await userSupabase.from("worker_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (worker && worker.id === match.worker_id) return "worker";

  const { data: company } = await userSupabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  if (company && company.id === (match as any).jobs?.company_id) return "employer";

  return null;
}
