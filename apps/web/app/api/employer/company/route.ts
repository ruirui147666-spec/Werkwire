import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  legal_name: z.string().min(1),
  trade_name: z.string().min(1),
  nipc: z.string().min(9).max(9).optional(),
  sector: z.string().min(1),
  size_band: z.string().optional(),
  description: z.string().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
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

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      owner_user_id: user.id,
      legal_name: body.legal_name,
      trade_name: body.trade_name,
      nipc: body.nipc || null,
      sector: body.sector,
      size_band: body.size_band ?? null,
      description: body.description ?? null,
      website: body.website || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("billing_accounts").insert({ company_id: company.id, credits_balance: 0 });

  return NextResponse.json({ ok: true, company_id: company.id });
}
