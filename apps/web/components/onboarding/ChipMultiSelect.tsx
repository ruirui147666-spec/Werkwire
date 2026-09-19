"use client";

import { Chip } from "@/components/ui/Chip";

export function ChipMultiSelect<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Chip key={opt.value} selected={selected.includes(opt.value)} onClick={() => toggle(opt.value)}>
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
