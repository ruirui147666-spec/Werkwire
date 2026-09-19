export const USER_ROLES = ["worker", "employer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AVAILABILITY = ["active", "passive", "unavailable"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const CONTRACT_TYPES = [
  "permanent",
  "fixed_term",
  "temporary",
  "freelance",
  "internship",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const MATCH_STATUS = [
  "pending",
  "worker_accepted",
  "employer_accepted",
  "confirmed",
  "declined_worker",
  "declined_employer",
  "expired",
] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const DECLINE_REASONS = [
  "salary",
  "distance",
  "schedule",
  "skills",
  "sector",
  "contract_type",
  "other",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const JOB_STATUS = [
  "draft",
  "active",
  "paused",
  "demoted",
  "filled",
  "closed",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const VERIFICATION_LEVELS = [
  "none",
  "phone",
  "email",
  "identity",
  "full",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DECLINE_REASON_LABELS_PT: Record<DeclineReason, string> = {
  salary: "Salário",
  distance: "Distância",
  schedule: "Horário",
  skills: "Competências",
  sector: "Setor",
  contract_type: "Tipo de contrato",
  other: "Outro",
};
