import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function addCredits(admin: SupabaseClient, companyId: string, credits: number): Promise<void> {
  const { data: billing } = await admin.from("billing_accounts").select("credits_balance").eq("company_id", companyId).single();
  const current = billing?.credits_balance ?? 0;
  await admin.from("billing_accounts").update({ credits_balance: current + credits }).eq("company_id", companyId);
}
