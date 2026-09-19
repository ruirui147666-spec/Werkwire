import { NextResponse } from "next/server";
import { z } from "zod";
import { geoPointSchema, hardNoSchema, weeklyScheduleSchema, workerSkillSchema } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";
import { embedText, workerEmbeddingText } from "@/lib/embeddings";

const payloadSchema = z.object({
  headline: z.string().min(1).max(120),
  skills: z.array(workerSkillSchema).min(1),
  location_label: z.string().min(1),
  location_point: geoPointSchema,
  max_commute_minutes: z.number().int().positive(),
  commute_modes: z.array(z.string()).min(1),
  salary_min: z.number().int().positive(),
  salary_ideal: z.number().int().positive(),
  weekly_availability: weeklyScheduleSchema,
  accepts_nights: z.boolean(),
  accepts_weekends: z.boolean(),
  accepted_contracts: z.array(z.string()).min(1),
  accepted_work_modes: z.array(z.string()).min(1),
  hard_nos: z.array(hardNoSchema),
  blocked_sectors: z.array(z.string()),
  licences: z.array(z.string()),
  work_authorisation: z.string(),
  phone: z.string().min(9),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const embedding = await embedText(workerEmbeddingText({ headline: body.headline, summary: null, skills: body.skills }));

  const alias = `Candidato #${user.id.slice(0, 4).toUpperCase()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ phone: body.phone, phone_verified: true })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: upsertError } = await supabase.from("worker_profiles").upsert(
    {
      user_id: user.id,
      display_alias: alias,
      headline: body.headline,
      years_experience: 0,
      location_point: `POINT(${body.location_point.lng} ${body.location_point.lat})`,
      location_label: body.location_label,
      max_commute_minutes: body.max_commute_minutes,
      commute_modes: body.commute_modes,
      salary_min: body.salary_min,
      salary_ideal: body.salary_ideal,
      accepted_contracts: body.accepted_contracts,
      accepted_work_modes: body.accepted_work_modes,
      availability: "active",
      weekly_availability: body.weekly_availability,
      accepts_nights: body.accepts_nights,
      accepts_weekends: body.accepts_weekends,
      skills: body.skills,
      languages: [{ code: "pt", level: "native" }],
      licences: body.licences,
      certifications: [],
      work_authorisation: body.work_authorisation,
      blocked_sectors: body.blocked_sectors,
      hard_nos: body.hard_nos,
      verification_level: "phone",
      embedding,
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
