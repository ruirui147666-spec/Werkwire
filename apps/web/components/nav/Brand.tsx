import { cn } from "@/lib/cn";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
        W
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink-900">Werkwire</span>
    </div>
  );
}
