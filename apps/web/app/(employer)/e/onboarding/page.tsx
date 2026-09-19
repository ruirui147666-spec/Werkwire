"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/nav/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { SECTORS, SIZE_BANDS } from "@/lib/domain/catalog";

export default function EmployerOnboardingPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [sector, setSector] = useState<string>("hospitality");
  const [sizeBand, setSizeBand] = useState<string>(SIZE_BANDS[0]);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/employer/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_name: legalName,
        trade_name: tradeName,
        sector,
        size_band: sizeBand,
        description,
        website: website || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível criar a empresa.");
      setSubmitting(false);
      return;
    }

    router.push("/e/jobs/new");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-surface-subtle px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-xl font-semibold text-ink-900">A sua empresa</h1>
          <p className="mb-6 text-sm text-ink-500">Precisamos destes dados antes de publicar a primeira vaga.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="trade_name">Nome comercial</Label>
              <Input id="trade_name" required value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="legal_name">Nome legal (conforme registo)</Label>
              <Input id="legal_name" required value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div>
              <Label>Setor</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map((s) => (
                  <Chip key={s.slug} selected={sector === s.slug} onClick={() => setSector(s.slug)} type="button">
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Dimensão</Label>
              <div className="flex flex-wrap gap-2">
                {SIZE_BANDS.map((b) => (
                  <Chip key={b} selected={sizeBand === b} onClick={() => setSizeBand(b)} type="button">
                    {b} pessoas
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descrição breve</Label>
              <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="website">Website (opcional)</Label>
              <Input id="website" type="url" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {error && <p className="text-sm text-danger-500">{error}</p>}
            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {submitting ? "A criar…" : "Continuar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
