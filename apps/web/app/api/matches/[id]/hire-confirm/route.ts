import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveParticipant } from "@/lib/matching/participant";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const role = await resolveParticipant(supabase, admin, id, user.id);
  if (!role) return NextResponse.json({ error: "Não autorizado para este match." }, { status: 403 });

  const { data: existing } = await admin.from("hires").select("*").eq("match_id", id).maybeSingle();

  const update =
    role === "worker" ? { confirmed_by_worker: true } : { confirmed_by_employer: true };

  const { data: hire, error } = await admin
    .from("hires")
    .upsert({ match_id: id, ...(existing ?? {}), ...update }, { onConflict: "match_id" })
    .select("confirmed_by_worker, confirmed_by_employer")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bothConfirmed = hire.confirmed_by_worker && hire.confirmed_by_employer;
  if (bothConfirmed) {
    await admin.from("pipeline_events").insert({ match_id: id, stage: "hired", actor_id: user.id });
  }

  return NextResponse.json({ ok: true, bothConfirmed, hire });
}
