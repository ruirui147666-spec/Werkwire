"use client";

import { cn } from "@/lib/cn";

export interface RequiredSkillDraft {
  slug: string;
  label: string;
  weight: "essential" | "desirable";
  min_years: number;
}

/**
 * §7.2 passo 4: "arrastar cada uma para Essencial ou Desejável — a UI
 * força esta distinção". Em mobile, um toggle de 3 estados por toque
 * cumpre a mesma exigência sem depender de drag-and-drop (fraco em touch).
 */
export function SkillWeightPicker({
  options,
  value,
  onChange,
}: {
  options: readonly { slug: string; label: string }[];
  value: RequiredSkillDraft[];
  onChange: (next: RequiredSkillDraft[]) => void;
}) {
  function stateOf(slug: string) {
    return value.find((v) => v.slug === slug)?.weight ?? null;
  }

  function cycle(slug: string, label: string) {
    const current = stateOf(slug);
    if (current === null) {
      onChange([...value, { slug, label, weight: "essential", min_years: 0 }]);
    } else if (current === "essential") {
      onChange(value.map((v) => (v.slug === slug ? { ...v, weight: "desirable" } : v)));
    } else {
      onChange(value.filter((v) => v.slug !== slug));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const state = stateOf(opt.slug);
        return (
          <button
            key={opt.slug}
            type="button"
            onClick={() => cycle(opt.slug, opt.label)}
            className={cn(
              "focus-ring flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              state === "essential" && "border-brand-500 bg-brand-500 text-white",
              state === "desirable" && "border-accent-500 bg-accent-50 text-accent-600",
              state === null && "border-ink-200 bg-surface text-ink-700 hover:border-ink-300"
            )}
          >
            {opt.label}
            {state === "essential" && <span className="text-xs opacity-80">· essencial</span>}
            {state === "desirable" && <span className="text-xs opacity-80">· desejável</span>}
          </button>
        );
      })}
    </div>
  );
}
