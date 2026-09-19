import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@werkwire/shared";

export interface SessionProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone_verified: boolean;
  email_verified: boolean;
}

/** Returns null when there's no signed-in user — callers decide whether to redirect. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_verified, email_verified")
    .eq("id", user.id)
    .single();

  return (profile as SessionProfile) ?? null;
}

/** Redirects to /login (or a role-appropriate area) unless the session matches `role`. */
export async function requireRole(role: UserRole): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?next=${role === "worker" ? "/w" : "/e"}`);
  if (profile.role !== role) redirect(profile.role === "worker" ? "/w" : profile.role === "employer" ? "/e" : "/admin");
  return profile;
}
