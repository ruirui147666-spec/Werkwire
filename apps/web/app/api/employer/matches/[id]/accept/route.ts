import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryConfirmMatch } from "@/lib/matching/confirm";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).single();
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("id, status, job_id, expires_at, jobs!inner(company_id)")
    .eq("id", id)
    .single();

  if (!match || (match as any).jobs?.company_id !== company.id) {
    return NextResponse.json({ error: "Match não encontrado." }, { status: 404 });
  }

  if (new Date(match.expires_at) < new Date() && match.status === "pending") {
    await admin.from("matches").update({ status: "expired" }).eq("id", id);
    return NextResponse.json({ error: "Este match expirou." }, { status: 400 });
  }

  if (match.status === "confirmed" || match.status === "employer_accepted") {
    return NextResponse.json({ ok: true, status: match.status });
  }
  if (match.status !== "pending" && match.status !== "worker_accepted") {
    return NextResponse.json({ error: "Este match já não está disponível." }, { status: 400 });
  }

  const wouldConfirm = match.status === "worker_accepted";

  const { error } = await admin
    .from("matches")
    .update({
      status: wouldConfirm ? "worker_accepted" : "employer_accepted", // unchanged if wouldConfirm; tryConfirmMatch flips it
      employer_responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!wouldConfirm) {
    return NextResponse.json({ ok: true, status: "employer_accepted" });
  }

  const result = await tryConfirmMatch(admin, id);
  if (!result.confirmed) {
    return NextResponse.json(
      {
        error: "Sem créditos suficientes para confirmar este match. Compre créditos em Faturação.",
        needsBilling: true,
      },
      { status: 402 }
    );
  }
  return NextResponse.json({ ok: true, status: "confirmed" });
}
