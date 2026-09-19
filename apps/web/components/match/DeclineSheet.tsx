"use client";

import { useState } from "react";
import { DECLINE_REASON_LABELS_PT, type DeclineReason } from "@werkwire/shared";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

const REASONS = Object.keys(DECLINE_REASON_LABELS_PT) as DeclineReason[];

export function DeclineSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: DeclineReason, note?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!reason) return;
    setSubmitting(true);
    await onConfirm(reason, note || undefined);
    setSubmitting(false);
    setReason(null);
    setNote("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Porque está a recusar?">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "focus-ring rounded-xl border px-3 py-3 text-left text-sm font-medium",
              reason === r ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700"
            )}
          >
            {DECLINE_REASON_LABELS_PT[r]}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        placeholder="Nota opcional…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-4"
      />
      <Button fullWidth variant="danger" disabled={!reason || submitting} onClick={handleConfirm}>
        {submitting ? "A recusar…" : "Confirmar recusa"}
      </Button>
    </Sheet>
  );
}
