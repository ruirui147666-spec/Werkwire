import type { WorkMode } from "@werkwire/shared";

export function scoreWorkMode(accepted: WorkMode[], jobMode: WorkMode): number {
  return accepted.includes(jobMode) ? 1.0 : 0.0;
}
