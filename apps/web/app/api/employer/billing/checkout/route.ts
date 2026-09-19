import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_PACKS, getStripe, isStripeConfigured } from "@/lib/stripe";
import { clientEnv } from "@/lib/env";

const payloadSchema = z.object({ packIndex: z.number().int().min(0).max(CREDIT_PACKS.length - 1) });

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe não está configurado neste ambiente. Defina STRIPE_SECRET_KEY para ativar pagamentos reais." },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).single();
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const { data: billing } = await supabase
    .from("billing_accounts")
    .select("stripe_customer_id")
    .eq("company_id", company.id)
    .single();

  const pack = CREDIT_PACKS[parsed.data.packIndex];
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: billing?.stripe_customer_id ?? undefined,
    customer_email: billing?.stripe_customer_id ? undefined : user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: pack.priceCents,
          product_data: { name: `Werkwire — pacote de ${pack.credits} matches` },
        },
        quantity: 1,
      },
    ],
    metadata: { kind: "credits", company_id: company.id, credits: String(pack.credits) },
    success_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/e/billing?checkout=success`,
    cancel_url: `${clientEnv.NEXT_PUBLIC_APP_URL}/e/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
