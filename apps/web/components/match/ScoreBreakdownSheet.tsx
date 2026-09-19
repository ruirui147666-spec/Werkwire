"use client";

import type { ScoreBreakdown } from "@werkwire/shared";
import { Sheet } from "@/components/ui/Sheet";

const LABELS: Record<string, string> = {
  skills: "Competências",
  experience: "Experiência",
  languages: "Línguas",
  schedule: "Horário",
  commute: "Deslocação",
  semantic: "Adequação geral",
  salary: "Salário",
  contract: "Tipo de contrato",
  work_mode: "Modalidade",
  employer_reputation: "Reputação da empresa",
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-ink-700">{label}</span>
        <span className="font-medium text-ink-900">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export function ScoreBreakdownSheet({
  open,
  onClose,
  breakdown,
  perspective,
}: {
  open: boolean;
  onClose: () => void;
  breakdown: ScoreBreakdown;
  perspective: "worker" | "employer";
}) {
  const section = perspective === "worker" ? breakdown.soft_worker : breakdown.soft_employer;

  return (
    <Sheet open={open} onClose={onClose} title="Porque vejo isto?">
      <p className="mb-4 text-sm text-ink-500">
        Cada match só existe quando serve bem os dois lados. Este é o detalhe do seu lado — veja o essencial:
      </p>
      {Object.entries(section).map(([key, c]) => (
        <Bar key={key} label={LABELS[key] ?? key} value={c.raw} />
      ))}
      <div className="mt-4 rounded-xl bg-surface-subtle p-3 text-xs text-ink-500">
        Score final (média harmónica dos dois lados): <strong>{Math.round(breakdown.harmonic * 100)}%</strong>
        {breakdown.commute_estimated && " · deslocação estimada"}
      </div>
    </Sheet>
  );
}
