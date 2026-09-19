/**
 * Fase 0 do plano de construção: correr o motor sobre fixtures reais,
 * sem qualquer UI, e imprimir os matches com as explicações.
 *
 * Uso:
 *   pnpm --filter @werkwire/matching-engine simulate <fixture.json>
 *
 * O fixture é um JSON com { workers: WorkerProfile[], jobs: Job[] }
 * (coordenadas como { lat, lng }). Gera-se um a partir do Supabase com:
 *
 *   select json_build_object('workers', ..., 'jobs', ...) from ...
 *
 * (ver supabase/seed.sql para o esquema exacto de coordenadas via PostGIS).
 */
import { readFileSync } from "node:fs";
import { haversineKm, type Job, type WorkerProfile } from "@werkwire/shared";
import { runMatching } from "../src/index.js";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("Uso: simulate <fixture.json>");
  process.exit(1);
}

const { workers, jobs } = JSON.parse(readFileSync(fixturePath, "utf-8")) as {
  workers: WorkerProfile[];
  jobs: Job[];
};

// Camada 3 do §6.3: haversine / velocidade média, usada só quando não há
// cache de deslocação real. Nunca chamar uma API paga por par em lote.
function commuteMinutes(w: WorkerProfile, j: Job): number {
  const km = haversineKm(w.location_point, j.location_point);
  return Math.round((km / 20) * 60);
}

const commuteMatrix = new Map<string, number>();
const similarityMatrix = new Map<string, number>();
for (const w of workers) {
  for (const j of jobs) {
    const key = `${w.id}:${j.id}`;
    commuteMatrix.set(key, commuteMinutes(w, j));
    similarityMatrix.set(key, 0.7); // sem embeddings reais neste modo standalone
  }
}

const result = runMatching({
  workers,
  jobs,
  commuteMatrix,
  similarityMatrix,
  existingPairs: new Set(),
  quotas: { workerDaily: 3, jobPerCycle: 5 },
  engineVersion: "1.0.0",
});

console.log("Estatísticas do ciclo:", result.stats);
console.log(`\n${result.matches.length} matches:\n`);

for (const m of result.matches) {
  const w = workers.find((w) => w.id === m.workerId)!;
  const j = jobs.find((j) => j.id === m.jobId)!;
  console.log(`${w.display_alias} × "${j.title}"  (harmónica=${m.harmonicScore.toFixed(3)})`);
  console.log(`  trabalhador: ${m.explanationWorker}`);
  console.log(`  empregador:  ${m.explanationEmployer}\n`);
}
