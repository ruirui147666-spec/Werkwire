import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({ nipc: z.string().min(9).max(9) });

/**
 * Stub de verificação — num sistema em produção isto validaria o NIPC
 * contra a base pública (RNPC) e o domínio do email do responsável.
 * Aqui só valida o formato (9 dígitos) e marca como verificado, para que
 * o resto do fluxo (bloqueio de publicação, desbloqueio de múltiplas
 * vagas) possa ser demonstrado de ponta a ponta.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success || !/^\d{9}$/.test(parsed.data.nipc)) {
    return NextResponse.json({ error: "NIPC inválido — tem de ter 9 dígitos." }, { status: 400 });
  }

  const { error } = await supabase
    .from("companies")
    .update({ nipc: parsed.data.nipc, nipc_verified: true, verification_level: "identity" })
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
