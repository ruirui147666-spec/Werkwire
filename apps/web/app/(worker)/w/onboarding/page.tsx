"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyWeeklySchedule, type ContractType, type HardNo, type WorkMode } from "@werkwire/shared";
import { StepHeader } from "@/components/ui/StepHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { ChipMultiSelect } from "@/components/onboarding/ChipMultiSelect";
import { WeeklyGrid } from "@/components/onboarding/WeeklyGrid";
import {
  CONTRACT_LABELS,
  FREGUESIAS,
  HARD_NO_OPTIONS,
  LICENCES_CATALOG,
  SECTORS,
  SKILLS_CATALOG,
  WORK_MODE_LABELS,
} from "@/lib/domain/catalog";

const TOTAL_STEPS = 9;

interface OnboardingState {
  headline: string;
  skillSlugs: string[];
  locationLabel: string;
  maxCommuteMinutes: number;
  commuteModes: string[];
  salaryMin: number;
  salaryIdeal: number;
  weeklyAvailability: ReturnType<typeof emptyWeeklySchedule>;
  acceptsNights: boolean;
  acceptsWeekends: boolean;
  acceptedContracts: ContractType[];
  acceptedWorkModes: WorkMode[];
  hardNoTypes: string[];
  blockedSectors: string[];
  licences: string[];
  phone: string;
  phoneCode: string;
}

const CONTRACT_OPTIONS: ContractType[] = ["permanent", "fixed_term", "temporary", "freelance", "internship"];
const WORK_MODE_OPTIONS: WorkMode[] = ["onsite", "hybrid", "remote"];

export default function WorkerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneSent, setPhoneSent] = useState(false);

  const [state, setState] = useState<OnboardingState>({
    headline: "",
    skillSlugs: [],
    locationLabel: "",
    maxCommuteMinutes: 45,
    commuteModes: ["transit"],
    salaryMin: 900,
    salaryIdeal: 1050,
    weeklyAvailability: emptyWeeklySchedule(),
    acceptsNights: false,
    acceptsWeekends: false,
    acceptedContracts: ["permanent"],
    acceptedWorkModes: ["onsite"],
    hardNoTypes: [],
    blockedSectors: [],
    licences: [],
    phone: "",
    phoneCode: "",
  });

  function update<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return state.skillSlugs.length > 0 && state.headline.trim().length > 0;
      case 2:
        return state.locationLabel.length > 0;
      case 4:
        return state.salaryMin > 0;
      case 6:
        return state.acceptedContracts.length > 0 && state.acceptedWorkModes.length > 0;
      case 9:
        return phoneSent && state.phoneCode.length === 6;
      default:
        return true;
    }
  }, [step, state, phoneSent]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const freguesia = FREGUESIAS.find((f) => f.label === state.locationLabel) ?? FREGUESIAS[0];

    const payload = {
      headline: state.headline,
      skills: state.skillSlugs.map((slug) => ({
        slug,
        label: SKILLS_CATALOG.find((s) => s.slug === slug)?.label ?? slug,
        years: 1,
        verified: false,
      })),
      location_label: freguesia.label,
      location_point: { lat: freguesia.lat, lng: freguesia.lng },
      max_commute_minutes: state.maxCommuteMinutes,
      commute_modes: state.commuteModes,
      salary_min: state.salaryMin,
      salary_ideal: state.salaryIdeal,
      weekly_availability: state.weeklyAvailability,
      accepts_nights: state.acceptsNights,
      accepts_weekends: state.acceptsWeekends,
      accepted_contracts: state.acceptedContracts,
      accepted_work_modes: state.acceptedWorkModes,
      hard_nos: state.hardNoTypes.map((type) => ({ type })) as HardNo[],
      blocked_sectors: state.blockedSectors,
      licences: state.licences,
      work_authorisation: "eu",
      phone: state.phone,
    };

    const res = await fetch("/api/worker/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível guardar o perfil. Tente novamente.");
      setSubmitting(false);
      return;
    }

    router.push("/w");
    router.refresh();
  }

  function next() {
    if (step === TOTAL_STEPS) {
      handleSubmit();
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  return (
    <div className="min-h-dvh bg-surface-subtle pb-28">
      <StepHeader
        step={step}
        totalSteps={TOTAL_STEPS}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
        onExit={() => router.push("/")}
        title="Criar perfil"
      />

      <div className="container-app max-w-lg py-6">
        {step === 1 && (
          <StepShell title="O que sabe fazer?">
            <div className="mb-5">
              <Label htmlFor="headline">Numa frase, quem é você profissionalmente?</Label>
              <Input
                id="headline"
                placeholder="Ex.: Empregado de mesa, 3 anos"
                value={state.headline}
                onChange={(e) => update("headline", e.target.value)}
              />
            </div>
            <Label>Competências</Label>
            <ChipMultiSelect
              options={SKILLS_CATALOG.map((s) => ({ value: s.slug, label: s.label }))}
              selected={state.skillSlugs}
              onChange={(v) => update("skillSlugs", v)}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Onde mora?">
            <div className="flex flex-wrap gap-2">
              {FREGUESIAS.map((f) => (
                <Chip key={f.label} selected={state.locationLabel === f.label} onClick={() => update("locationLabel", f.label)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Até quanto tempo aceita viajar?">
            <div className="mb-5 flex flex-wrap gap-2">
              {[15, 30, 45, 60].map((m) => (
                <Chip key={m} selected={state.maxCommuteMinutes === m} onClick={() => update("maxCommuteMinutes", m)}>
                  {m === 60 ? "60+ min" : `${m} min`}
                </Chip>
              ))}
            </div>
            <Label>Como costuma deslocar-se?</Label>
            <ChipMultiSelect
              options={[
                { value: "transit", label: "Transportes públicos" },
                { value: "car", label: "Carro" },
                { value: "walk", label: "A pé" },
                { value: "bike", label: "Bicicleta" },
              ]}
              selected={state.commuteModes}
              onChange={(v) => update("commuteModes", v)}
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Quanto precisa de ganhar, no mínimo?">
            <div className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <Label className="mb-0">Mínimo aceitável</Label>
                <span className="text-lg font-semibold text-ink-900">{state.salaryMin}€/mês</span>
              </div>
              <input
                type="range"
                min={700}
                max={2500}
                step={25}
                value={state.salaryMin}
                onChange={(e) => update("salaryMin", Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <Label className="mb-0">Salário ideal</Label>
                <span className="text-lg font-semibold text-ink-900">{state.salaryIdeal}€/mês</span>
              </div>
              <input
                type="range"
                min={state.salaryMin}
                max={3000}
                step={25}
                value={state.salaryIdeal}
                onChange={(e) => update("salaryIdeal", Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title="Quando pode trabalhar?">
            <WeeklyGrid value={state.weeklyAvailability} onChange={(v) => update("weeklyAvailability", v)} />
            <div className="mt-5 flex flex-col gap-2">
              <ToggleRow
                label="Aceito turnos noturnos"
                checked={state.acceptsNights}
                onChange={(v) => update("acceptsNights", v)}
              />
              <ToggleRow
                label="Aceito trabalhar aos fins de semana"
                checked={state.acceptsWeekends}
                onChange={(v) => update("acceptsWeekends", v)}
              />
            </div>
          </StepShell>
        )}

        {step === 6 && (
          <StepShell title="Que tipo de contrato aceita?">
            <div className="mb-5">
              <Label>Contratos</Label>
              <ChipMultiSelect
                options={CONTRACT_OPTIONS.map((c) => ({ value: c, label: CONTRACT_LABELS[c] }))}
                selected={state.acceptedContracts}
                onChange={(v) => update("acceptedContracts", v)}
              />
            </div>
            <Label>Modalidade</Label>
            <ChipMultiSelect
              options={WORK_MODE_OPTIONS.map((m) => ({ value: m, label: WORK_MODE_LABELS[m] }))}
              selected={state.acceptedWorkModes}
              onChange={(v) => update("acceptedWorkModes", v)}
            />
          </StepShell>
        )}

        {step === 7 && (
          <StepShell title="O que nunca aceita?" subtitle="Estas são eliminatórias — nunca lhe mostramos uma vaga assim.">
            <div className="mb-5">
              <ChipMultiSelect
                options={HARD_NO_OPTIONS.map((h) => ({ value: h.type, label: h.label }))}
                selected={state.hardNoTypes}
                onChange={(v) => update("hardNoTypes", v)}
              />
            </div>
            <Label>Setores a evitar</Label>
            <ChipMultiSelect
              options={SECTORS.map((s) => ({ value: s.slug, label: s.label }))}
              selected={state.blockedSectors}
              onChange={(v) => update("blockedSectors", v)}
            />
          </StepShell>
        )}

        {step === 8 && (
          <StepShell title="Tem alguma carta ou certificado?">
            <ChipMultiSelect
              options={LICENCES_CATALOG.map((l) => ({ value: l.slug, label: l.label }))}
              selected={state.licences}
              onChange={(v) => update("licences", v)}
            />
          </StepShell>
        )}

        {step === 9 && (
          <StepShell title="Verificação por SMS" subtitle="Só usamos o seu número para confirmar que é uma pessoa real.">
            <div className="mb-4">
              <Label htmlFor="phone">Número de telemóvel</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+351 9XX XXX XXX"
                value={state.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            {!phoneSent ? (
              <Button variant="outline" disabled={state.phone.length < 9} onClick={() => setPhoneSent(true)}>
                Enviar código
              </Button>
            ) : (
              <div>
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={state.phoneCode}
                  onChange={(e) => update("phoneCode", e.target.value.replace(/\D/g, ""))}
                />
                <p className="mt-2 text-xs text-ink-400">
                  Ambiente de demonstração: qualquer código de 6 dígitos é aceite.
                </p>
              </div>
            )}
          </StepShell>
        )}

        {error && <p className="mt-4 text-sm text-danger-500">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink-100 bg-surface p-4">
        <div className="container-app max-w-lg">
          <Button fullWidth size="lg" disabled={!canContinue || submitting} onClick={next}>
            {submitting ? "A guardar…" : step === TOTAL_STEPS ? "Concluir" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-ink-900">{title}</h1>
      {subtitle && <p className="mb-5 text-sm text-ink-500">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="focus-ring flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-left text-sm font-medium text-ink-900"
    >
      {label}
      <span
        className={`ml-3 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-brand-500" : "bg-ink-200"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}
