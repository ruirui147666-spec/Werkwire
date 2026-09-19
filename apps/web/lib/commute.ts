import { haversineKm, type GeoPoint } from "@werkwire/shared";

// §6.3 — camada 3 (fallback): distância / velocidade média do modo.
// Nunca chamar uma API paga por par no ciclo em lote; camadas 1/2 (matriz
// pré-calculada + cache por freguesia) ficam para uma fase seguinte —
// documentado no README como próximo passo de infraestrutura.
const AVG_SPEED_KM_H: Record<string, number> = {
  car: 28,
  transit: 16,
  walk: 5,
  bike: 15,
};

export interface CommuteEstimate {
  minutes: number;
  estimated: true;
}

export function estimateCommuteMinutes(from: GeoPoint, to: GeoPoint, modes: string[]): CommuteEstimate {
  const km = haversineKm(from, to);
  const bestSpeed = Math.max(...modes.map((m) => AVG_SPEED_KM_H[m] ?? AVG_SPEED_KM_H.transit), AVG_SPEED_KM_H.transit);
  const minutes = Math.round((km / bestSpeed) * 60);
  return { minutes, estimated: true };
}
