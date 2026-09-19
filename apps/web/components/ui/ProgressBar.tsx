import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
