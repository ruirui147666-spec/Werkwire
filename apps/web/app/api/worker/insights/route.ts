import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Melhorar o perfil" (§7.5): sugestões concretas com impacto estimado.
 * O impacto é uma contagem agregada de vagas ativas — nunca a lista de
 * vagas em si, que continua vedada ao trabalhador fora de um match (P2).
 * Por isso corre com o cliente admin (bypassa RLS só para o COUNT).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: worker } = await supabase
    .from("worker_profiles")
    .select("salary_min, max_commute_minutes, accepts_nights, accepts_weekends, licences")
    .eq("user_id", user.id)
    .single();
  if (!worker) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });

  const admin = createAdminClient();

  const [{ count: total }, { count: withLowerSalary }, { count: withNights }, { count: withForklift }] =
    await Promise.all([
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("salary_max", Math.round(worker.salary_min * 0.85))
        .lt("salary_max", worker.salary_min),
      worker.accepts_nights
        ? { count: 0 }
        : admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active").eq("has_nights", true),
      worker.licences.includes("forklift")
        ? { count: 0 }
        : admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active").contains("required_licences", ["forklift"]),
    ]);

  const suggestions: { text: string; impact: number }[] = [];
  if ((withLowerSalary ?? 0) > 0) {
    suggestions.push({
      text: `Descer o salário mínimo em ~15% abre ${withLowerSalary} vagas compatíveis`,
      impact: withLowerSalary ?? 0,
    });
  }
  if (!worker.accepts_nights && (withNights ?? 0) > 0) {
    suggestions.push({ text: `Aceitar turnos noturnos abre ${withNights} vagas compatíveis`, impact: withNights ?? 0 });
  }
  if (!worker.licences.includes("forklift") && (withForklift ?? 0) > 0) {
    suggestions.push({
      text: `Adicionar carta de empilhador abre ${withForklift} vagas compatíveis`,
      impact: withForklift ?? 0,
    });
  }

  return NextResponse.json({ totalActiveJobs: total ?? 0, suggestions: suggestions.sort((a, b) => b.impact - a.impact).slice(0, 3) });
}
