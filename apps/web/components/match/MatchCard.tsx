"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import type { DeclineReason, MatchStatus, ScoreBreakdown } from "@werkwire/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeclineSheet } from "@/components/match/DeclineSheet";
import { ContestSheet } from "@/components/match/ContestSheet";
import { ScoreBreakdownSheet } from "@/components/match/ScoreBreakdownSheet";
import { explanationToBullets, hoursUntil } from "@/lib/domain/explain";

export interface MatchCardProps {
  perspective: "worker" | "employer";
  status: MatchStatus;
  harmonicScore: number;
  title: string;
  subtitle: string;
  salaryLine: string;
  explanation: string;
  aboutTitle: string;
  aboutLines: string[];
  expiresAt: string;
  scoreBreakdown: ScoreBreakdown;
  chatHref?: string;
  onAccept: () => Promise<void>;
  onDecline: (reason: DeclineReason, note?: string) => Promise<void>;
  onContest: (note: string) => Promise<void>;
}

const STATUS_NOTE: Partial<Record<MatchStatus, { worker: string; employer: string }>> = {
  worker_accepted: { worker: "Já aceitou — a aguardar a empresa.", employer: "O candidato já aceitou — falta só você." },
  employer_accepted: { worker: "A empresa já aceitou — falta só você.", employer: "Já aceitou — a aguardar o candidato." },
};

export function MatchCard(props: MatchCardProps) {
  const {
    perspective,
    status,
    harmonicScore,
    title,
    subtitle,
    salaryLine,
    explanation,
    aboutTitle,
    aboutLines,
    expiresAt,
    scoreBreakdown,
    chatHref,
    onAccept,
    onDecline,
    onContest,
  } = props;

  const [declineOpen, setDeclineOpen] = useState(false);
  const [contestOpen, setContestOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const myDeclinedStatus = perspective === "worker" ? "declined_worker" : "declined_employer";
  const iAlreadyAccepted =
    (perspective === "worker" && (status === "worker_accepted" || status === "confirmed")) ||
    (perspective === "employer" && (status === "employer_accepted" || status === "confirmed"));
  const isFinal = status === "confirmed" || status === "expired" || status.startsWith("declined");
  const canRespond = status === "pending" || (perspective === "worker" ? status === "employer_accepted" : status === "worker_accepted");

  const note = STATUS_NOTE[status];

  return (
    <Card className="overflow-visible">
      <div className="mb-4 flex items-center justify-between">
        <Badge tone="brand">✦ {status === "confirmed" ? "MATCH CONFIRMADO" : "NOVO MATCH"}</Badge>
        <span className="text-lg font-bold text-brand-600">{Math.round(harmonicScore * 100)}%</span>
      </div>

      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mb-1 text-sm text-ink-500">{subtitle}</p>
      <p className="mb-4 text-sm font-medium text-ink-700">{salaryLine}</p>

      <div className="mb-4 rounded-xl bg-surface-subtle p-3.5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Porquê este match</p>
        <ul className="space-y-1.5">
          {explanationToBullets(explanation).map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent-500" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4 rounded-xl border border-ink-100 p-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
          <ShieldCheck size={14} /> {aboutTitle}
        </p>
        <div className="space-y-1 text-sm text-ink-700">
          {aboutLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      {!isFinal && (
        <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-warn-500">
          <Clock size={14} /> Faltam {hoursUntil(expiresAt)} horas para responder
        </p>
      )}
      {note && !isFinal && <p className="mb-4 text-xs text-ink-400">{note[perspective]}</p>}

      {status === myDeclinedStatus && <p className="mb-2 text-sm font-medium text-ink-400">Recusou este match.</p>}
      {status === "expired" && <p className="mb-2 text-sm font-medium text-ink-400">Este match expirou.</p>}
      {status === "confirmed" && chatHref && (
        <Link href={chatHref} className="mb-3 block">
          <Button fullWidth>Abrir conversa</Button>
        </Link>
      )}
      {iAlreadyAccepted && status !== "confirmed" && (
        <p className="mb-2 text-sm font-medium text-brand-600">Você já aceitou.</p>
      )}

      {canRespond && !iAlreadyAccepted && (
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setDeclineOpen(true)}>
            Recusar
          </Button>
          <Button
            fullWidth
            disabled={accepting}
            onClick={async () => {
              setAccepting(true);
              await onAccept();
              setAccepting(false);
            }}
          >
            {accepting ? "A aceitar…" : "Aceitar"}
          </Button>
        </div>
      )}

      <div className="mt-3 flex justify-center gap-4 text-xs text-ink-400">
        <button type="button" onClick={() => setBreakdownOpen(true)} className="hover:text-ink-600 hover:underline">
          Porque vejo isto?
        </button>
        <button type="button" onClick={() => setContestOpen(true)} className="hover:text-ink-600 hover:underline">
          Contestar
        </button>
      </div>

      <DeclineSheet open={declineOpen} onClose={() => setDeclineOpen(false)} onConfirm={async (r, n) => { await onDecline(r, n); setDeclineOpen(false); }} />
      <ContestSheet open={contestOpen} onClose={() => setContestOpen(false)} onConfirm={async (n) => { await onContest(n); setContestOpen(false); }} />
      <ScoreBreakdownSheet
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        breakdown={scoreBreakdown}
        perspective={perspective}
      />
    </Card>
  );
}
