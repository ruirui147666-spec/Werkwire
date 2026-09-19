import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({ note: z.string().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Descreva o motivo da contestação." }, { status: 400 });

  const { data: worker } = await supabase.from("worker_profiles").select("id").eq("user_id", user.id).single();
  if (!worker) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, worker_id").eq("id", id).single();
  if (!match || match.worker_id !== worker.id) {
    return NextResponse.json({ error: "Match não encontrado." }, { status: 404 });
  }

  const { error } = await admin
    .from("matches")
    .update({ contested: true, contested_at: new Date().toISOString(), contest_note: parsed.data.note })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
