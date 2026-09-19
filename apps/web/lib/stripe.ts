import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let stripeInstance: Stripe | null = null;

/** Throws if STRIPE_SECRET_KEY isn't set — callers should only reach this in employer billing routes. */
export function getStripe(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY não está configurada.");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(serverEnv.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY);
}

// Credit packs, per spec §10 ("10 / 25 / 50 matches, com desconto crescente").
export const CREDIT_PACKS = [
  { credits: 10, priceCents: 39000, label: "10 matches" }, // 39€/match
  { credits: 25, priceCents: 87500, label: "25 matches" }, // 35€/match
  { credits: 50, priceCents: 160000, label: "50 matches" }, // 32€/match
] as const;

// Per-match charge at confirmation, by sector (spec: "19–49€, consoante o setor").
export const MATCH_PRICE_CENTS_BY_SECTOR: Record<string, number> = {
  hospitality: 1900,
  retail: 2400,
  logistics: 2900,
  default: 2400,
};

export function matchPriceCents(sector: string): number {
  return MATCH_PRICE_CENTS_BY_SECTOR[sector] ?? MATCH_PRICE_CENTS_BY_SECTOR.default;
}
