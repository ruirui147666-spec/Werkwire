import { NextResponse } from "next/server";
import { declineRequestSchema } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = declineRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "É obrigatório indicar um motivo." }, { status: 400 });
  }

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).single();
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("id, status, jobs!inner(company_id)")
    .eq("id", id)
    .single();

  if (!match || (match as any).jobs?.company_id !== company.id) {
    return NextResponse.json({ error: "Match não encontrado." }, { status: 404 });
  }
  if (["confirmed", "declined_worker", "declined_employer", "expired"].includes(match.status)) {
    return NextResponse.json({ error: "Este match já não pode ser recusado." }, { status: 400 });
  }

  const { error } = await admin
    .from("matches")
    .update({
      status: "declined_employer",
      employer_responded_at: new Date().toISOString(),
      employer_decline_reason: parsed.data.reason,
      decline_note: parsed.data.note ?? null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
