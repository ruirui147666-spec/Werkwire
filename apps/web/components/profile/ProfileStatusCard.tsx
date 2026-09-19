"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Availability } from "@werkwire/shared";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const OPTIONS: { value: Availability; label: string; hint: string }[] = [
  { value: "active", label: "Ativo", hint: "A receber matches normalmente" },
  { value: "passive", label: "Passivo", hint: "Só matches muito fortes" },
  { value: "unavailable", label: "Indisponível", hint: "Nenhum match novo (snooze)" },
];

export function ProfileStatusCard({ availability }: { availability: Availability }) {
  const router = useRouter();
  const [current, setCurrent] = useState(availability);
  const [saving, setSaving] = useState(false);

  async function update(value: Availability) {
    setSaving(true);
    const res = await fetch("/api/worker/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availability: value }),
    });
    if (res.ok) {
      setCurrent(value);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-ink-900">Estado do perfil</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={saving}
            onClick={() => update(opt.value)}
            className={cn(
              "focus-ring rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors",
              current === opt.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-400">{OPTIONS.find((o) => o.value === current)?.hint}</p>
    </Card>
  );
}
