"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DeclineReason, MatchStatus, ScoreBreakdown } from "@werkwire/shared";
import { MatchCard } from "@/components/match/MatchCard";

export interface WorkerMatchView {
  id: string;
  status: MatchStatus;
  harmonicScore: number;
  title: string;
  subtitle: string;
  salaryLine: string;
  explanation: string;
  aboutLines: string[];
  expiresAt: string;
  scoreBreakdown: ScoreBreakdown;
}

export function WorkerMatchesList({ matches }: { matches: WorkerMatchView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(matches);

  // Keep local (optimistic) state in sync once the server re-fetches after
  // router.refresh() — a plain useState(prop) only seeds the initial value.
  useEffect(() => setItems(matches), [matches]);

  async function callAction(id: string, path: string, body?: unknown) {
    const res = await fetch(`/api/worker/matches/${id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <div className="space-y-4">
      {items.map((m) => (
        <MatchCard
          key={m.id}
          perspective="worker"
          status={m.status}
          harmonicScore={m.harmonicScore}
          title={m.title}
          subtitle={m.subtitle}
          salaryLine={m.salaryLine}
          explanation={m.explanation}
          aboutTitle="Sobre este empregador"
          aboutLines={m.aboutLines}
          expiresAt={m.expiresAt}
          scoreBreakdown={m.scoreBreakdown}
          chatHref={`/w/matches/${m.id}`}
          onAccept={async () => {
            const ok = await callAction(m.id, "accept");
            if (ok) setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "worker_accepted" } : x)));
          }}
          onDecline={async (reason, note) => {
            const ok = await callAction(m.id, "decline", { reason, note });
            if (ok) setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "declined_worker" } : x)));
          }}
          onContest={async (note) => {
            await callAction(m.id, "contest", { note });
          }}
        />
      ))}
    </div>
  );
}
