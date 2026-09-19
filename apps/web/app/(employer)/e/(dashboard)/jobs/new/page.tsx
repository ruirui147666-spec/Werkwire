"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyWeeklySchedule, type ContractType, type WorkMode } from "@werkwire/shared";
import { StepHeader } from "@/components/ui/StepHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { ChipMultiSelect } from "@/components/onboarding/ChipMultiSelect";
import { WeeklyGrid } from "@/components/onboarding/WeeklyGrid";
import { SkillWeightPicker, type RequiredSkillDraft } from "@/components/onboarding/SkillWeightPicker";
import {
  CONTRACT_LABELS,
  FREGUESIAS,
  LICENCES_CATALOG,
  MEDIAN_SALARY_BY_SECTOR,
  SECTORS,
  SKILLS_CATALOG,
  WORK_MODE_LABELS,
} from "@/lib/domain/catalog";

const TOTAL_STEPS = 6;
const CONTRACT_OPTIONS: ContractType[] = ["permanent", "fixed_term", "temporary", "freelance", "internship"];
const WORK_MODE_OPTIONS: WorkMode[] = ["onsite", "hybrid", "remote"];

interface JobState {
  rawText: string;
  title: string;
  description: string;
  sector: string;
  salaryMin: number;
  salaryMax: number;
  contract: ContractType;
  workMode: WorkMode;
  locationLabel: string;
  weeklySchedule: ReturnType<typeof emptyWeeklySchedule>;
  hasNights: boolean;
  hasWeekends: boolean;
  requiredSkills: RequiredSkillDraft[];
  minYearsExperience: number;
  requiredLicences: string[];
  positionsCount: number;
  fillByDate: string;
  intentConfirmed: boolean;
}

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [state, setState] = useState<JobState>({
    rawText: "",
    title: "",
    description: "",
    sector: "hospitality",
    salaryMin: 950,
    salaryMax: 1200,
    contract: "permanent",
    workMode: "onsite",
    locationLabel: "",
    weeklySchedule: emptyWeeklySchedule(),
    hasNights: false,
    hasWeekends: false,
    requiredSkills: [],
    minYearsExperience: 0,
    requiredLicences: [],
    positionsCount: 1,
    fillByDate: "",
    intentConfirmed: false,
  });

  function update<K extends keyof JobState>(key: K, value: JobState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return state.title.trim().length > 0 && state.description.trim().length > 0;
      case 2:
        return state.salaryMax >= state.salaryMin && state.salaryMin > 0;
      case 3:
        return state.locationLabel.length > 0;
      case 5:
        return state.positionsCount > 0 && state.fillByDate.length > 0 && state.intentConfirmed;
      default:
        return true;
    }
  }, [step, state]);

  async function handleParse() {
    if (!state.rawText.trim()) return;
    setParsing(true);
    const res = await fetch("/api/employer/jobs/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: state.rawText }),
    });
    const body = await res.json().catch(() => ({}));
    const suggestion = body.suggestion;
    if (suggestion) {
      setState((s) => ({
        ...s,
        title: suggestion.title ?? s.title,
        description: suggestion.description ?? s.description,
        sector: suggestion.sector ?? s.sector,
        contract: (suggestion.contract as ContractType) ?? s.contract,
        workMode: (suggestion.work_mode as WorkMode) ?? s.workMode,
        requiredSkills: suggestion.required_skills ?? s.requiredSkills,
      }));
    } else if (!state.title) {
      // Sem Groq configurado: pelo menos aproveita a primeira linha como título.
      setState((s) => ({ ...s, title: s.rawText.split("\n")[0].slice(0, 80) }));
    }
    setParsing(false);
  }

  async function handleCreateAndPublish() {
    setSubmitting(true);
    setError(null);

    const freguesia = FREGUESIAS.find((f) => f.label === state.locationLabel) ?? FREGUESIAS[0];

    const payload = {
      title: state.title,
      description: state.description,
      sector: state.sector,
      salary_min: state.salaryMin,
      salary_max: state.salaryMax,
      contract: state.contract,
      work_mode: state.workMode,
      location_label: freguesia.label,
      location_point: { lat: freguesia.lat, lng: freguesia.lng },
      weekly_schedule: state.weeklySchedule,
      has_nights: state.hasNights,
      has_weekends: state.hasWeekends,
      required_skills: state.requiredSkills,
      min_years_experience: state.minYearsExperience,
      required_licences: state.requiredLicences,
      required_certs: [],
      requires_work_auth: true,
      positions_count: state.positionsCount,
      fill_by_date: state.fillByDate,
    };

    const createRes = await fetch("/api/employer/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createBody = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      setError(createBody.error ?? "Não foi possível criar a vaga.");
      setSubmitting(false);
      return;
    }

    const publishRes = await fetch(`/api/employer/jobs/${createBody.job_id}/publish`, { method: "POST" });
    if (!publishRes.ok) {
      const publishBody = await publishRes.json().catch(() => ({}));
      setPublishError(publishBody.error ?? "A vaga foi criada como rascunho, mas não foi publicada.");
      setSubmitting(false);
      setStep(7);
      return;
    }

    setStep(7);
    setSubmitting(false);
  }

  function next() {
    if (step === TOTAL_STEPS) {
      handleCreateAndPublish();
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  if (step === 7) {
    return (
      <div className="container-app max-w-lg py-16 text-center">
        {publishError ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-ink-900">Vaga criada, mas não publicada</h1>
            <p className="mb-6 text-sm text-danger-500">{publishError}</p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-ink-900">Vaga publicada</h1>
            <p className="mb-6 text-sm text-ink-500">
              A partir do próximo ciclo de matching, os candidatos compatíveis vão começar a aparecer aqui.
            </p>
          </>
        )}
        <Button onClick={() => router.push("/e")}>Ver as minhas vagas</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-subtle pb-28">
      <StepHeader
        step={step}
        totalSteps={TOTAL_STEPS}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
        onExit={() => router.push("/e")}
        title="Nova vaga"
      />

      <div className="container-app max-w-lg py-6">
        {step === 1 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Descreva a vaga</h1>
            <p className="mb-5 text-sm text-ink-500">
              Escreva livremente ou cole um anúncio que já tenha — nós estruturamos, você confirma.
            </p>
            <Textarea
              rows={5}
              placeholder="Ex.: Precisamos de um empregado de mesa para o nosso restaurante em Alvalade…"
              value={state.rawText}
              onChange={(e) => update("rawText", e.target.value)}
              className="mb-3"
            />
            <Button variant="outline" size="sm" onClick={handleParse} disabled={parsing || !state.rawText.trim()}>
              {parsing ? "A estruturar…" : "Estruturar automaticamente"}
            </Button>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={state.title} onChange={(e) => update("title", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" rows={4} value={state.description} onChange={(e) => update("description", e.target.value)} />
              </div>
              <div>
                <Label>Setor</Label>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((s) => (
                    <Chip key={s.slug} selected={state.sector === s.slug} onClick={() => update("sector", s.slug)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Salário</h1>
            <p className="mb-5 text-sm text-ink-500">
              Obrigatório — vagas sem salário não publicam. Mediana na zona para este setor:{" "}
              <strong>{MEDIAN_SALARY_BY_SECTOR[state.sector] ?? 1050}€/mês</strong>.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary_min">Mínimo (€/mês)</Label>
                <Input
                  id="salary_min"
                  type="number"
                  value={state.salaryMin}
                  onChange={(e) => update("salaryMin", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="salary_max">Máximo (€/mês)</Label>
                <Input
                  id="salary_max"
                  type="number"
                  value={state.salaryMax}
                  onChange={(e) => update("salaryMax", Number(e.target.value))}
                />
              </div>
            </div>
            {state.salaryMax < state.salaryMin && (
              <p className="mt-2 text-sm text-danger-500">O máximo não pode ser inferior ao mínimo.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Horário, local e contrato</h1>
            <div className="mb-5 mt-4">
              <Label>Local</Label>
              <div className="flex flex-wrap gap-2">
                {FREGUESIAS.map((f) => (
                  <Chip key={f.label} selected={state.locationLabel === f.label} onClick={() => update("locationLabel", f.label)}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <Label>Horário semanal</Label>
              <WeeklyGrid value={state.weeklySchedule} onChange={(v) => update("weeklySchedule", v)} />
            </div>
            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de contrato</Label>
                <div className="flex flex-wrap gap-2">
                  {CONTRACT_OPTIONS.map((c) => (
                    <Chip key={c} selected={state.contract === c} onClick={() => update("contract", c)}>
                      {CONTRACT_LABELS[c]}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label>Modalidade</Label>
                <div className="flex flex-wrap gap-2">
                  {WORK_MODE_OPTIONS.map((m) => (
                    <Chip key={m} selected={state.workMode === m} onClick={() => update("workMode", m)}>
                      {WORK_MODE_LABELS[m]}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Competências</h1>
            <p className="mb-5 text-sm text-ink-500">
              Toque uma vez para marcar como <strong>essencial</strong>, outra vez para <strong>desejável</strong>.
            </p>
            <SkillWeightPicker
              options={SKILLS_CATALOG}
              value={state.requiredSkills}
              onChange={(v) => update("requiredSkills", v)}
            />
            <div className="mt-5">
              <Label htmlFor="min_years">Anos de experiência mínimos</Label>
              <Input
                id="min_years"
                type="number"
                min={0}
                value={state.minYearsExperience}
                onChange={(e) => update("minYearsExperience", Number(e.target.value))}
              />
            </div>
            <div className="mt-5">
              <Label>Requisitos eliminatórios (cartas/certificados)</Label>
              <ChipMultiSelect
                options={LICENCES_CATALOG.map((l) => ({ value: l.slug, label: l.label }))}
                selected={state.requiredLicences}
                onChange={(v) => update("requiredLicences", v)}
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Declaração de intenção</h1>
            <p className="mb-5 text-sm text-ink-500">Fica público no perfil da empresa.</p>
            <div className="mb-4">
              <Label htmlFor="positions">Quantas pessoas precisa de contratar?</Label>
              <Input
                id="positions"
                type="number"
                min={1}
                value={state.positionsCount}
                onChange={(e) => update("positionsCount", Number(e.target.value))}
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="fill_by">Até quando?</Label>
              <Input
                id="fill_by"
                type="date"
                value={state.fillByDate}
                onChange={(e) => update("fillByDate", e.target.value)}
              />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-ink-200 p-4 text-sm">
              <input
                type="checkbox"
                checked={state.intentConfirmed}
                onChange={(e) => update("intentConfirmed", e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-brand-500"
              />
              <span>
                Confirmo que preciso de {state.positionsCount || "N"}{" "}
                {state.positionsCount === 1 ? "pessoa" : "pessoas"} até {state.fillByDate || "[data]"}. Esta
                declaração fica pública no perfil da empresa.
              </span>
            </label>
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink-900">Rever e publicar</h1>
            <p className="mb-5 text-sm text-ink-500">Confirme os detalhes antes de publicar a vaga.</p>
            <div className="card divide-y divide-ink-100 p-0">
              <Row label="Título" value={state.title} />
              <Row label="Setor" value={SECTORS.find((s) => s.slug === state.sector)?.label ?? state.sector} />
              <Row label="Salário" value={`${state.salaryMin}–${state.salaryMax}€/mês`} />
              <Row label="Local" value={state.locationLabel} />
              <Row label="Contrato" value={CONTRACT_LABELS[state.contract]} />
              <Row label="Modalidade" value={WORK_MODE_LABELS[state.workMode]} />
              <Row label="Posições" value={String(state.positionsCount)} />
              <Row label="Prazo" value={state.fillByDate} />
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-danger-500">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink-100 bg-surface p-4">
        <div className="container-app max-w-lg">
          <Button fullWidth size="lg" disabled={!canContinue || submitting} onClick={next}>
            {submitting ? "A publicar…" : step === TOTAL_STEPS ? "Publicar vaga" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
