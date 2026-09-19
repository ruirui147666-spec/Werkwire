import type { ContractType } from "@werkwire/shared";

export function scoreContract(accepted: ContractType[], jobContract: ContractType): number {
  return accepted.includes(jobContract) ? 1.0 : 0.0;
}
