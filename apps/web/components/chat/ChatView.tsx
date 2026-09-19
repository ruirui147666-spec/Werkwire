"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

const STAGES = [
  { key: "chat", label: "Conversa" },
  { key: "interview_scheduled", label: "Entrevista" },
  { key: "offer", label: "Proposta" },
  { key: "hired", label: "Contratado" },
] as const;

export function ChatView({
  matchId,
  conversationId,
  currentUserId,
  counterpartName,
  initialMessages,
  currentStage,
  hire,
  perspective,
}: {
  matchId: string;
  conversationId: string;
  currentUserId: string;
  counterpartName: string;
  initialMessages: ChatMessage[];
  currentStage: (typeof STAGES)[number]["key"];
  hire: { confirmed_by_worker: boolean; confirmed_by_employer: boolean };
  perspective: "worker" | "employer";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState(currentStage);
  const [hireState, setHireState] = useState(hire);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Sem realtime nesta fase — poll leve mantém a conversa razoavelmente
  // atual sem depender de subscrições Supabase Realtime.
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`).catch(() => null);
      if (res?.ok) {
        const body = await res.json();
        if (body.messages) setMessages(body.messages);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, senderId: currentUserId, body, createdAt: new Date().toISOString() },
      ]);
    }
    setSending(false);
  }

  async function advanceStage(next: (typeof STAGES)[number]["key"]) {
    setStage(next);
    await fetch(`/api/matches/${matchId}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next }),
    });
    router.refresh();
  }

  async function confirmHire() {
    const res = await fetch(`/api/matches/${matchId}/hire-confirm`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      setHireState(body.hire);
      if (body.bothConfirmed) setStage("hired");
    }
  }

  const myConfirmed = perspective === "worker" ? hireState.confirmed_by_worker : hireState.confirmed_by_employer;
  const bothConfirmed = hireState.confirmed_by_worker && hireState.confirmed_by_employer;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-[calc(100dvh-2rem)]">
      <div className="border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink-900">{counterpartName}</p>
        <div className="mt-2 flex gap-1">
          {STAGES.map((s, i) => {
            const stageIndex = STAGES.findIndex((x) => x.key === stage);
            const done = i <= stageIndex;
            return (
              <div key={s.key} className="flex-1">
                <div className={cn("h-1.5 rounded-full", done ? "bg-brand-500" : "bg-ink-100")} />
                <p className={cn("mt-1 text-[10px]", done ? "text-brand-600" : "text-ink-400")}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.senderId === currentUserId ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                m.senderId === currentUserId ? "bg-brand-500 text-white" : "bg-surface-muted text-ink-900"
              )}
            >
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-100 p-3">
        {!bothConfirmed ? (
          <button
            type="button"
            onClick={confirmHire}
            disabled={myConfirmed}
            className={cn(
              "focus-ring mb-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
              myConfirmed ? "border-accent-300 bg-accent-50 text-accent-600" : "border-ink-200 text-ink-700 hover:border-ink-300"
            )}
          >
            <CheckCircle2 size={16} />
            {myConfirmed ? "Aguarda a confirmação do outro lado" : "Confirmar contratação"}
          </button>
        ) : (
          <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-accent-600">
            <CheckCircle2 size={16} /> Contratação confirmada por ambos
          </p>
        )}

        {perspective === "employer" && stage !== "hired" && (
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {STAGES.filter((s) => s.key !== "chat").map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => advanceStage(s.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                  stage === s.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Escreva uma mensagem…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <Button onClick={send} disabled={sending || !text.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
