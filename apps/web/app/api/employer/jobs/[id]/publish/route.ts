import { NextResponse } from "next/server";
import { WEEKDAYS } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: company } = await supabase
    .from("companies")
    .select("id, nipc_verified")
    .eq("owner_user_id", user.id)
    .single();
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, salary_min, salary_max, weekly_schedule, fill_by_date, status")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();
  if (!job) return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });

  // Bloqueios de publicação (§7.2).
  if (!job.salary_min || !job.salary_max) {
    return NextResponse.json({ error: "A vaga precisa de um intervalo salarial." }, { status: 400 });
  }
  const hasSchedule = WEEKDAYS.some((day) => (job.weekly_schedule?.[day]?.length ?? 0) > 0);
  if (!hasSchedule) {
    return NextResponse.json({ error: "A vaga precisa de um horário." }, { status: 400 });
  }
  if (!job.fill_by_date) {
    return NextResponse.json({ error: "Indique a data limite para preencher a vaga." }, { status: 400 });
  }

  if (!company.nipc_verified) {
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("status", "active");
    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        { error: "Sem verificação de NIPC só pode ter 1 vaga ativa. Verifique a empresa para publicar mais." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
