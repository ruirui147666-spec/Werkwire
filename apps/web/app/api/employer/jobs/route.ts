import { NextResponse } from "next/server";
import { z } from "zod";
import { geoPointSchema, requiredSkillSchema, weeklyScheduleSchema } from "@werkwire/shared";
import { createClient } from "@/lib/supabase/server";
import { embedText, jobEmbeddingText } from "@/lib/embeddings";

const payloadSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1),
  sector: z.string().min(1),
  salary_min: z.number().int().positive(),
  salary_max: z.number().int().positive(),
  contract: z.string(),
  work_mode: z.string(),
  location_label: z.string().min(1),
  location_point: geoPointSchema,
  weekly_schedule: weeklyScheduleSchema,
  has_nights: z.boolean(),
  has_weekends: z.boolean(),
  required_skills: z.array(requiredSkillSchema),
  min_years_experience: z.number().min(0),
  required_licences: z.array(z.string()),
  required_certs: z.array(z.string()),
  requires_work_auth: z.boolean(),
  positions_count: z.number().int().positive(),
  fill_by_date: z.string(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  if (body.salary_max < body.salary_min) {
    return NextResponse.json({ error: "O salário máximo não pode ser inferior ao mínimo." }, { status: 400 });
  }

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).single();
  if (!company) return NextResponse.json({ error: "Crie primeiro o perfil da empresa." }, { status: 400 });

  const embedding = await embedText(jobEmbeddingText(body));

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      company_id: company.id,
      created_by: user.id,
      title: body.title,
      description: body.description,
      sector: body.sector,
      salary_min: body.salary_min,
      salary_max: body.salary_max,
      contract: body.contract,
      work_mode: body.work_mode,
      location_point: `POINT(${body.location_point.lng} ${body.location_point.lat})`,
      location_label: body.location_label,
      weekly_schedule: body.weekly_schedule,
      has_nights: body.has_nights,
      has_weekends: body.has_weekends,
      required_skills: body.required_skills,
      min_years_experience: body.min_years_experience,
      required_licences: body.required_licences,
      required_certs: body.required_certs,
      requires_work_auth: body.requires_work_auth,
      positions_count: body.positions_count,
      fill_by_date: body.fill_by_date,
      intent_signed_by: user.id,
      status: "draft",
      embedding,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, job_id: job.id });
}
