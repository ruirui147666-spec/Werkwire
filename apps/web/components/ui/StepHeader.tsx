"use client";

import { ChevronLeft, X } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

/** Shared header for step-by-step flows (onboarding, job creation): back, step count, exit. */
export function StepHeader({
  step,
  totalSteps,
  onBack,
  onExit,
  title,
}: {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  onExit?: () => void;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-ink-100 bg-surface/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label="Voltar"
          className="focus-ring -ml-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted disabled:opacity-0"
        >
          <ChevronLeft size={22} />
        </button>
        {title && <p className="text-sm font-medium text-ink-500">{title}</p>}
        <button
          type="button"
          onClick={onExit}
          aria-label="Sair"
          className="focus-ring -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
        >
          <X size={20} />
        </button>
      </div>
      <ProgressBar value={step} max={totalSteps} />
    </div>
  );
}
