import type { Job, ScoreBreakdown, WorkerProfile } from "@werkwire/shared";

interface ContributionEntry {
  key: string;
  label: string;
  raw: number;
  contribution: number;
}

const EMPLOYER_LABELS: Record<string, string> = {
  skills: "competências pedidas",
  experience: "experiência",
  languages: "línguas",
  schedule: "horário",
  commute: "deslocação",
  semantic: "adequação geral",
};

const WORKER_LABELS: Record<string, string> = {
  salary: "salário",
  commute: "deslocação",
  schedule: "horário",
  contract: "tipo de contrato",
  work_mode: "modalidade",
  employer_reputation: "reputação da empresa",
};

function topContributions(
  section: ScoreBreakdown["soft_employer"] | ScoreBreakdown["soft_worker"],
  labels: Record<string, string>,
  n: number
): ContributionEntry[] {
  return Object.entries(section)
    .map(([key, c]) => ({ key, label: labels[key] ?? key, raw: c.raw, contribution: c.contribution }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, n);
}

export function explainForWorker(breakdown: ScoreBreakdown, job: Job): string {
  const top = topContributions(breakdown.soft_worker, WORKER_LABELS, 3);
  const parts: string[] = [];

  for (const t of top) {
    if (t.key === "salary" && t.raw > 0) {
      parts.push(`o salário (${job.salary_min}–${job.salary_max}€) cobre o que pediu`);
    } else if (t.key === "commute") {
      parts.push(`fica a ${Math.round(breakdown.commute_minutes)} min de sua casa`);
    } else if (t.key === "schedule" && t.raw >= 0.6) {
      parts.push("o horário é compatível com a sua disponibilidade");
    } else if (t.key === "contract" && t.raw > 0) {
      parts.push(`o tipo de contrato (${job.contract}) é um dos que aceita`);
    } else if (t.key === "work_mode" && t.raw > 0) {
      parts.push(`a modalidade (${job.work_mode}) é uma das que aceita`);
    } else if (t.key === "employer_reputation" && t.raw >= 0.6) {
      parts.push("a empresa tem um bom histórico de resposta");
    }
  }

  if (parts.length === 0) parts.push("o perfil e a vaga têm boa afinidade geral");

  return `Match porque: ${parts.join(", ")}.`;
}

export function explainForEmployer(breakdown: ScoreBreakdown, worker: WorkerProfile): string {
  const top = topContributions(breakdown.soft_employer, EMPLOYER_LABELS, 3);
  const parts: string[] = [];

  for (const t of top) {
    if (t.key === "skills") {
      parts.push(`${Math.round(t.raw * 100)}% das competências pedidas`);
    } else if (t.key === "experience") {
      parts.push(`${worker.years_experience} anos de experiência`);
    } else if (t.key === "commute") {
      parts.push(`vive a ${Math.round(breakdown.commute_minutes)} min do local`);
    } else if (t.key === "schedule" && t.raw >= 0.6) {
      parts.push("disponibilidade compatível com o horário da vaga");
    } else if (t.key === "languages" && t.raw >= 0.8) {
      parts.push("cumpre os requisitos de línguas");
    } else if (t.key === "semantic" && t.raw >= 0.5) {
      parts.push("perfil bastante alinhado com a descrição da vaga");
    }
  }

  if (parts.length === 0) parts.push("boa afinidade geral com o perfil pedido");

  return `Match porque: ${parts.join(", ")}.`;
}

/**
 * Negative explanation shown to a worker with no recent matches.
 * `medianSalaryForZone` and `compatibleJobsIfLowered` are computed by the
 * caller (server side) from recent cycle data — this function only renders text.
 */
export function explainNoMatches(
  worker: WorkerProfile,
  medianSalaryForZone: number,
  compatibleJobsIfLowered: number
): string {
  if (worker.salary_min > medianSalaryForZone) {
    const pct = Math.round(((worker.salary_min - medianSalaryForZone) / medianSalaryForZone) * 100);
    return `Não teve matches esta semana porque o seu salário mínimo está ${pct}% acima da mediana da sua zona para esta função. Se descer para ${medianSalaryForZone}€, aparecem ${compatibleJobsIfLowered} vagas compatíveis.`;
  }
  return "Não teve matches esta semana. O seu perfil está ativo — o próximo ciclo de matching corre em breve.";
}
