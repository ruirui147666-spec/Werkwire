import type { CompanyReputation } from "@werkwire/shared";
import { clamp } from "./salary.js";

export function scoreEmployerReputation(c: CompanyReputation): number {
  let score = c.response_rate_48h ?? 0.6; // no history yet -> neutral-positive

  if (c.ghost_flag) score *= 0.3;
  if (c.verification_level === "full") score += 0.1;

  return clamp(score, 0, 1);
}
