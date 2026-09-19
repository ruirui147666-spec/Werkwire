import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPriceCents } from "@/lib/stripe";

export type ConfirmResult = { confirmed: true } | { confirmed: false; reason: "insufficient_credits" };

/**
 * The moment BOTH sides have accepted (§10): charge one credit from the
 * employer's balance, and only if that succeeds, flip the match to
 * 'confirmed', open the conversation and seed the pipeline. Called from
 * whichever accept route (worker's or employer's) causes the transition —
 * charging happens on confirmation, never on hire, so nobody can dodge it
 * by moving to WhatsApp.
 *
 * If there's no credit balance, the transition simply doesn't happen —
 * the accepting side's own response is still recorded (responded_at), but
 * match.status stays at its current single-side-accepted value. The
 * employer buys credits at /e/billing and the next accept attempt (by
 * either side, since both routes call this) completes it.
 */
export async function tryConfirmMatch(admin: SupabaseClient, matchId: string): Promise<ConfirmResult> {
  const { data: match } = await admin
    .from("matches")
    .select("id, jobs!inner(company_id, sector)")
    .eq("id", matchId)
    .single();
  if (!match) return { confirmed: false, reason: "insufficient_credits" };

  const companyId = (match as any).jobs.company_id as string;
  const sector = (match as any).jobs.sector as string;

  const { data: billing } = await admin
    .from("billing_accounts")
    .select("credits_balance")
    .eq("company_id", companyId)
    .single();

  if (!billing || billing.credits_balance < 1) {
    return { confirmed: false, reason: "insufficient_credits" };
  }

  await admin
    .from("billing_accounts")
    .update({ credits_balance: billing.credits_balance - 1 })
    .eq("company_id", companyId);

  await admin.from("match_charges").insert({
    match_id: matchId,
    company_id: companyId,
    amount_cents: matchPriceCents(sector),
    method: "credit",
  });

  await admin.from("matches").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", matchId);
  await admin.from("conversations").insert({ match_id: matchId });
  await admin.from("pipeline_events").insert({ match_id: matchId, stage: "chat" });

  return { confirmed: true };
}
