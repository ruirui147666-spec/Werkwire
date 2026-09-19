"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

export function ContestSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!note.trim()) return;
    setSubmitting(true);
    await onConfirm(note.trim());
    setSubmitting(false);
    setNote("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Contestar este match">
      <p className="mb-3 text-sm text-ink-500">
        Um revisor humano vê este caso em até 5 dias úteis. Explique o que lhe parece errado.
      </p>
      <Textarea
        rows={4}
        placeholder="Descreva o problema…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-4"
      />
      <Button fullWidth disabled={!note.trim() || submitting} onClick={handleConfirm}>
        {submitting ? "A enviar…" : "Enviar contestação"}
      </Button>
    </Sheet>
  );
}
