import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/matching/billing";

export async function POST(request: Request) {
  if (!isStripeConfigured() || !serverEnv.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe não está configurado." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature ?? "", serverEnv.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const metadata = session.metadata ?? {};

    if (metadata.kind === "credits" && metadata.company_id && metadata.credits) {
      const admin = createAdminClient();
      await addCredits(admin, metadata.company_id, Number(metadata.credits));
    }
  }

  return NextResponse.json({ received: true });
}
