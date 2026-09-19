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

  const { data: worker } = await supabase.from("worker_profiles").select("id").eq("user_id", user.id).single();
  if (!worker) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });

  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, status, worker_id, expires_at").eq("id", id).single();
  if (!match || match.worker_id !== worker.id) {
    return NextResponse.json({ error: "Match não encontrado." }, { status: 404 });
  }

  if (new Date(match.expires_at) < new Date() && match.status === "pending") {
    await admin.from("matches").update({ status: "expired" }).eq("id", id);
    return NextResponse.json({ error: "Este match expirou." }, { status: 400 });
  }

  if (match.status === "confirmed" || match.status === "worker_accepted") {
    return NextResponse.json({ ok: true, status: match.status });
  }
  if (match.status !== "pending" && match.status !== "employer_accepted") {
    return NextResponse.json({ error: "Este match já não está disponível." }, { status: 400 });
  }

  const wouldConfirm = match.status === "employer_accepted";

  const { error } = await admin
    .from("matches")
    .update({
      status: wouldConfirm ? "employer_accepted" : "worker_accepted", // unchanged if wouldConfirm; tryConfirmMatch flips it
      worker_responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!wouldConfirm) {
    return NextResponse.json({ ok: true, status: "worker_accepted" });
  }

  const result = await tryConfirmMatch(admin, id);
  if (!result.confirmed) {
    return NextResponse.json({
      ok: true,
      status: "employer_accepted",
      note: "Você aceitou. A empresa ainda precisa de créditos para confirmar — avisamos assim que isso acontecer.",
    });
  }
  return NextResponse.json({ ok: true, status: "confirmed" });
}
