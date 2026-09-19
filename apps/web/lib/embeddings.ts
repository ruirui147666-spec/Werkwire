import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Deterministic offline embedding — a simple hashed bag-of-words projected
 * into a fixed-dimension vector, L2-normalised. It has none of the
 * semantic depth of a real multilingual model, but it's stable, free, and
 * good enough for the `semantic` signal to behave sanely in dev/demo
 * (identical/near-identical text -> high similarity; unrelated text ->
 * low similarity) while capped at weight 0.15 in the engine either way.
 *
 * Swap this out by pointing EMBEDDING_PROVIDER at a real provider once
 * one is chosen — the return contract (number[] of EMBEDDING_DIMS) is all
 * the rest of the app depends on.
 */
function localEmbedding(text: string, dims: number): number[] {
  const vector = new Array(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dims;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export async function embedText(text: string): Promise<number[]> {
  // No third-party embedding provider is wired up yet — 'local' is the
  // only implemented path (see EMBEDDING_PROVIDER in .env.example).
  return localEmbedding(text, serverEnv.EMBEDDING_DIMS);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function workerEmbeddingText(input: {
  headline?: string | null;
  summary?: string | null;
  skills: { label: string }[];
}): string {
  return [input.headline, input.summary, ...input.skills.map((s) => s.label)].filter(Boolean).join(". ");
}

export function jobEmbeddingText(input: {
  title: string;
  description: string;
  required_skills: { label: string }[];
}): string {
  return [input.title, input.description, ...input.required_skills.map((s) => s.label)].filter(Boolean).join(". ");
}
