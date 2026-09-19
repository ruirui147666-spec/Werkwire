"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DeclineReason, MatchStatus, ScoreBreakdown } from "@werkwire/shared";
import { MatchCard } from "@/components/match/MatchCard";

export interface EmployerMatchView {
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

export function EmployerMatchesList({ matches }: { matches: EmployerMatchView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(matches);

  useEffect(() => setItems(matches), [matches]);

  async function callAction(id: string, path: string, body?: unknown) {
    const res = await fetch(`/api/employer/matches/${id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) {
      router.refresh();
      return true;
    }
    const errBody = await res.json().catch(() => ({}));
    if (errBody.needsBilling) {
      if (window.confirm(`${errBody.error}\n\nIr para Faturação agora?`)) router.push("/e/billing");
    } else if (errBody.error) {
      window.alert(errBody.error);
    }
    return false;
  }

  return (
    <div className="space-y-4">
      {items.map((m) => (
        <MatchCard
          key={m.id}
          perspective="employer"
          status={m.status}
          harmonicScore={m.harmonicScore}
          title={m.title}
          subtitle={m.subtitle}
          salaryLine={m.salaryLine}
          explanation={m.explanation}
          aboutTitle="Sobre este candidato"
          aboutLines={m.aboutLines}
          expiresAt={m.expiresAt}
          scoreBreakdown={m.scoreBreakdown}
          chatHref={`/e/matches/${m.id}`}
          onAccept={async () => {
            const ok = await callAction(m.id, "accept");
            if (ok) setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "employer_accepted" } : x)));
          }}
          onDecline={async (reason, note) => {
            const ok = await callAction(m.id, "decline", { reason, note });
            if (ok) setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "declined_employer" } : x)));
          }}
          onContest={async (note) => {
            await callAction(m.id, "contest", { note });
          }}
        />
      ))}
    </div>
  );
}
