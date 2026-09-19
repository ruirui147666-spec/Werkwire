"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function BillingActions({ packs }: { packs: { credits: number; priceCents: number; label: string }[] }) {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(index: number) {
    setLoadingIndex(index);
    setError(null);
    const res = await fetch("/api/employer/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packIndex: index }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error ?? "Não foi possível iniciar o pagamento.");
    setLoadingIndex(null);
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {packs.map((pack, i) => (
          <Card key={pack.credits} className="text-center">
            <p className="text-2xl font-bold text-ink-900">{pack.credits}</p>
            <p className="mb-3 text-xs text-ink-500">matches</p>
            <p className="mb-4 text-sm font-medium text-ink-700">{(pack.priceCents / 100).toFixed(0)}€</p>
            <Button fullWidth size="sm" disabled={loadingIndex !== null} onClick={() => buy(i)}>
              {loadingIndex === i ? "A abrir…" : "Comprar"}
            </Button>
          </Card>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger-500">{error}</p>}
    </div>
  );
}
