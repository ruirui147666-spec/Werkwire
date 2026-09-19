"use client";

import type { WeeklySchedule } from "@werkwire/shared";
import { WEEKDAYS } from "@werkwire/shared";
import { DAY_LABELS, DAY_PERIODS } from "@/lib/domain/catalog";
import { cn } from "@/lib/cn";

/** Grelha semanal tocável (§7.1, passo 5) — 7 dias × 3 períodos, sem hora exata. */
export function WeeklyGrid({
  value,
  onChange,
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
}) {
  function isOn(day: (typeof WEEKDAYS)[number], period: (typeof DAY_PERIODS)[number]) {
    return value[day].some((slot) => slot.from === period.from && slot.to === period.to);
  }

  function toggle(day: (typeof WEEKDAYS)[number], period: (typeof DAY_PERIODS)[number]) {
    const current = value[day];
    const exists = isOn(day, period);
    const next = exists
      ? current.filter((slot) => !(slot.from === period.from && slot.to === period.to))
      : [...current, { from: period.from, to: period.to }];
    onChange({ ...value, [day]: next });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-16" />
            {WEEKDAYS.map((day) => (
              <th key={day} className="pb-1 text-xs font-semibold text-ink-500">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_PERIODS.map((period) => (
            <tr key={period.key}>
              <td className="pr-2 text-xs font-medium text-ink-500">{period.label}</td>
              {WEEKDAYS.map((day) => {
                const on = isOn(day, period);
                return (
                  <td key={day}>
                    <button
                      type="button"
                      onClick={() => toggle(day, period)}
                      aria-pressed={on}
                      aria-label={`${DAY_LABELS[day]} · ${period.label}`}
                      className={cn(
                        "focus-ring h-11 w-11 rounded-lg border transition-colors",
                        on ? "border-brand-500 bg-brand-500" : "border-ink-200 bg-surface hover:border-ink-300"
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
