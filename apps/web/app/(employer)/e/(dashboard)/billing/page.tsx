import { createClient } from "@/lib/supabase/server";
import { CREDIT_PACKS } from "@/lib/stripe";
import { BillingActions } from "@/components/billing/BillingActions";
import { Card } from "@/components/ui/Card";

export default async function EmployerBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user!.id).single();
  const { data: billing } = await supabase
    .from("billing_accounts")
    .select("credits_balance")
    .eq("company_id", company!.id)
    .single();

  const { data: charges } = await supabase
    .from("match_charges")
    .select("id, amount_cents, method, charged_at")
    .eq("company_id", company!.id)
    .order("charged_at", { ascending: false })
    .limit(20);

  return (
    <div className="container-app max-w-2xl py-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-900">Faturação</h1>

      <Card className="mb-6">
        <p className="text-sm text-ink-500">Saldo de créditos</p>
        <p className="text-3xl font-bold text-ink-900">{billing?.credits_balance ?? 0}</p>
        <p className="mt-1 text-xs text-ink-400">1 crédito = 1 match confirmado. O candidato nunca paga.</p>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink-700">Comprar créditos</h2>
      <BillingActions packs={CREDIT_PACKS as unknown as { credits: number; priceCents: number; label: string }[]} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-700">Histórico de cobranças</h2>
      {!charges || charges.length === 0 ? (
        <p className="text-sm text-ink-500">Ainda sem cobranças.</p>
      ) : (
        <div className="space-y-2">
          {charges.map((c) => (
            <Card key={c.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-ink-700">{new Date(c.charged_at).toLocaleDateString("pt-PT")}</span>
              <span className="text-sm text-ink-500">{c.method === "credit" ? "1 crédito" : "Stripe"}</span>
              <span className="text-sm font-medium text-ink-900">{(c.amount_cents / 100).toFixed(2)}€</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
