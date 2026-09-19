import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client — bypasses RLS entirely. Only ever import this from
 * API route handlers that enforce their own business rules (matching
 * cycle, accept/decline transactions, billing). Never expose to the client.
 */
export function createAdminClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada.");
  }
  return createSupabaseClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
