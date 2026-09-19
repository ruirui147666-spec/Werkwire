import { clamp } from "./salary.js";

/**
 * Normalises cosine similarity. Below 0.5 carries no signal in practice
 * for the embedding models we target, so we floor it there.
 */
export function scoreSemantic(cosineSimilarity: number): number {
  return clamp((cosineSimilarity - 0.5) / 0.4, 0, 1);
}
