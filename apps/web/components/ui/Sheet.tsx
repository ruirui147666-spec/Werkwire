"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative z-10 max-h-[85dvh] w-full max-w-sheet overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-raised sm:rounded-2xl"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
