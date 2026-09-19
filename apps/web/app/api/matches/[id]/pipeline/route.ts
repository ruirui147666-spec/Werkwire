import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveParticipant } from "@/lib/matching/participant";

const STAGES = ["chat", "interview_scheduled", "interview_done", "offer", "hired", "dropped"] as const;
const payloadSchema = z.object({ stage: z.enum(STAGES), note: z.string().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Fase inválida." }, { status: 400 });

  const admin = createAdminClient();
  const role = await resolveParticipant(supabase, admin, id, user.id);
  if (!role) return NextResponse.json({ error: "Não autorizado para este match." }, { status: 403 });

  const { error } = await admin
    .from("pipeline_events")
    .insert({ match_id: id, stage: parsed.data.stage, actor_id: user.id, note: parsed.data.note ?? null });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
