"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function ProfileTips() {
  const [suggestions, setSuggestions] = useState<{ text: string; impact: number }[] | null>(null);

  useEffect(() => {
    fetch("/api/worker/insights")
      .then((r) => r.json())
      .then((body) => setSuggestions(body.suggestions ?? []))
      .catch(() => setSuggestions([]));
  }, []);

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card className="mt-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <Lightbulb size={16} className="text-warn-500" /> Melhorar o perfil
      </p>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="rounded-xl bg-surface-subtle p-3 text-sm text-ink-700">
            {s.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}
