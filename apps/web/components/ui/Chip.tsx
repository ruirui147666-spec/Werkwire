import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { className, selected, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        "focus-ring inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        selected
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300",
        className
      )}
      {...props}
    />
  );
});
