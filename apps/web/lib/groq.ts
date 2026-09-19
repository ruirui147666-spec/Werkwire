import "server-only";
import { serverEnv } from "@/lib/env";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export function isGroqConfigured(): boolean {
  return Boolean(serverEnv.GROQ_API_KEY);
}

async function callGroqJson(systemPrompt: string, userContent: string): Promise<Record<string, unknown> | null> {
  if (!serverEnv.GROQ_API_KEY) return null;

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: serverEnv.GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    console.error("Groq request failed", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export interface ParsedResumeFields {
  headline?: string;
  summary?: string;
  years_experience?: number;
  skills?: { slug: string; label: string; years: number }[];
  languages?: { code: string; level: string }[];
  licences?: string[];
}

/**
 * CV → campos sugeridos. §7.1: "a pessoa confirma cada campo" — este
 * resultado nunca é gravado diretamente, é sempre uma sugestão para o
 * formulário de onboarding.
 */
export async function parseResumeText(rawText: string): Promise<ParsedResumeFields | null> {
  const result = await callGroqJson(
    `Extrai campos de um CV em português europeu para uma vaga de emprego operacional (hotelaria, retalho, logística).
Devolve APENAS JSON com: headline (string curta), summary (string curta), years_experience (número),
skills (array de {slug, label, years}), languages (array de {code, level: basic|intermediate|advanced|native}),
licences (array de strings, ex: driving_b, forklift, haccp). Nunca inventes dados que não estão no texto.`,
    rawText.slice(0, 8000)
  );
  return result as ParsedResumeFields | null;
}

export interface ParsedJobFields {
  title?: string;
  description?: string;
  sector?: string;
  contract?: string;
  work_mode?: string;
  required_skills?: { slug: string; label: string; weight: "essential" | "desirable"; min_years: number }[];
}

/** Anúncio em texto livre → campos estruturados de vaga. Também sempre confirmado pelo empregador. */
export async function parseJobPostingText(rawText: string): Promise<ParsedJobFields | null> {
  const result = await callGroqJson(
    `Estrutura um anúncio de vaga em português europeu. Devolve APENAS JSON com: title, description,
sector (um de: hospitality, retail, logistics, other), contract (permanent|fixed_term|temporary|freelance|internship),
work_mode (onsite|hybrid|remote), required_skills (array de {slug, label, weight: essential|desirable, min_years}).
Nunca inventes salário, horário ou requisitos legais que não estão no texto.`,
    rawText.slice(0, 8000)
  );
  return result as ParsedJobFields | null;
}

/**
 * Refina a redação de uma explicação já gerada por template determinístico.
 * O LLM NUNCA decide o conteúdo — só pode reescrever o texto dado, as
 * razões vêm sempre do motor (packages/matching-engine/src/explain.ts).
 */
export async function refineExplanationText(deterministicText: string): Promise<string> {
  if (!serverEnv.GROQ_API_KEY) return deterministicText;

  const result = await callGroqJson(
    `Reescreve a frase seguinte em português europeu natural, mantendo EXATAMENTE os mesmos factos e números,
sem adicionar nem remover nenhuma razão. Devolve APENAS JSON: {"text": "..."}.`,
    deterministicText
  );

  const text = result?.text;
  return typeof text === "string" && text.trim().length > 0 ? text : deterministicText;
}
