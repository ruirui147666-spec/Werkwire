import { NextResponse } from "next/server";
import { z } from "zod";
import { AVAILABILITY } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({ availability: z.enum(AVAILABILITY) });

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });

  const { error } = await supabase
    .from("worker_profiles")
    .update({ availability: parsed.data.availability, last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
