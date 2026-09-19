import type { AdjacencyMap, Job, ScoreBreakdown, WorkerProfile } from "@werkwire/shared";
import { allocate, type ScoredPair } from "./allocate.js";
import { explainForEmployer, explainForWorker } from "./explain.js";
import { computeFit } from "./fit.js";
import { isMatch } from "./reciprocal.js";
import { computeCongestionDivisor, computeFreshness, computePriority } from "./priority.js";
import { getWeights, type WeightSet } from "./weights/index.js";

export * from "./knockout.js";
export * from "./reciprocal.js";
export * from "./allocate.js";
export * from "./explain.js";
export * from "./fit.js";
export * from "./priority.js";
export { getWeights, allWeightSets } from "./weights/index.js";
export type { WeightSet } from "./weights/index.js";
export * as salary from "./soft/salary.js";
export * as skillsScoring from "./soft/skills.js";
export * as experienceScoring from "./soft/experience.js";
export * as commuteScoring from "./soft/commute.js";
export * as scheduleScoring from "./soft/schedule.js";
export * as languagesScoring from "./soft/languages.js";
export * as contractScoring from "./soft/contract.js";
export * as workModeScoring from "./soft/workMode.js";
export * as sectorScoring from "./soft/sector.js";
export * as semanticScoring from "./soft/semantic.js";
export * as employerReputationScoring from "./soft/employerReputation.js";

export interface MatchCandidate {
  workerId: string;
  jobId: string;
  fitEmployer: number;
  fitWorker: number;
  harmonicScore: number;
  priorityScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanationWorker: string;
  explanationEmployer: string;
  engineVersion: string;
  weightsVersion: string;
}

export interface CycleStats {
  workersEvaluated: number;
  jobsEvaluated: number;
  pairsScored: number;
  pairsPassedKnockout: number;
  pairsAboveThreshold: number;
  matchesCreated: number;
}

export interface RunMatchingInput {
  workers: WorkerProfile[];
  jobs: Job[];
  companySegmentByJobId?: Map<string, string>;
  commuteMatrix: Map<string, number>; // "workerId:jobId" -> minutes
  commuteEstimated?: Map<string, boolean>;
  similarityMatrix: Map<string, number>; // "workerId:jobId" -> cosine similarity
  adjacency?: AdjacencyMap;
  existingPairs: Set<string>; // "workerId:jobId" already matched before, never repeat
  quotas: { workerDaily: number; jobPerCycle: number };
  engineVersion: string;
  /** jobId -> number of currently-active (unexpired) matches, for congestion */
  activeMatchesPerJob?: Map<string, number>;
  /** days since job.published_at, per jobId */
  jobAgeDays?: Map<string, number>;
  /** historical response/acceptance probabilities, default to neutral priors when absent */
  employerResponseProbability?: Map<string, number>;
  workerAcceptProbability?: Map<string, number>;
}

export interface RunMatchingResult {
  matches: MatchCandidate[];
  stats: CycleStats;
}

function pairKey(workerId: string, jobId: string): string {
  return `${workerId}:${jobId}`;
}

export function runMatching(input: RunMatchingInput): RunMatchingResult {
  const {
    workers,
    jobs,
    companySegmentByJobId,
    commuteMatrix,
    commuteEstimated,
    similarityMatrix,
    adjacency,
    existingPairs,
    quotas,
    engineVersion,
    activeMatchesPerJob,
    jobAgeDays,
    employerResponseProbability,
    workerAcceptProbability,
  } = input;

  const activeJobs = jobs.filter((j) => j.status === "active");
  const candidates: { pair: ScoredPair; candidate: MatchCandidate }[] = [];

  let pairsScored = 0;
  let pairsPassedKnockout = 0;

  for (const job of activeJobs) {
    const weights: WeightSet = getWeights(companySegmentByJobId?.get(job.id));

    for (const worker of workers) {
      const key = pairKey(worker.id, job.id);
      if (existingPairs.has(key)) continue;

      const commuteMinutes = commuteMatrix.get(key);
      if (commuteMinutes == null) continue; // outside the candidate retrieval radius

      pairsScored++;

      const cosine = similarityMatrix.get(key) ?? 0.5;
      const fit = computeFit(
        worker,
        job,
        { commuteMinutes, commuteEstimated: commuteEstimated?.get(key), cosineSimilarity: cosine, adjacency },
        weights
      );

      if (!fit.knockout.passed) continue;
      pairsPassedKnockout++;

      if (!isMatch(fit.fitEmployer, fit.fitWorker, weights.threshold)) continue;

      const freshness = computeFreshness(jobAgeDays?.get(job.id) ?? 0);
      const congestionDivisor = computeCongestionDivisor(activeMatchesPerJob?.get(job.id) ?? 0);
      const pEmployerResponds = employerResponseProbability?.get(job.company_id) ?? 0.6;
      const pWorkerAccepts = workerAcceptProbability?.get(worker.id) ?? 0.5;

      const priority = computePriority(fit.harmonicScore, {
        pEmployerResponds,
        pWorkerAccepts,
        congestionDivisor,
        freshness,
      });

      const scoreBreakdown: ScoreBreakdown = {
        ...fit.breakdown,
        context: {
          p_employer_responds: pEmployerResponds,
          p_worker_accepts: pWorkerAccepts,
          congestion_divisor: congestionDivisor,
          freshness,
        },
        priority,
        engine_version: engineVersion,
        weights_version: weights.version,
      };

      const candidate: MatchCandidate = {
        workerId: worker.id,
        jobId: job.id,
        fitEmployer: fit.fitEmployer,
        fitWorker: fit.fitWorker,
        harmonicScore: fit.harmonicScore,
        priorityScore: priority,
        scoreBreakdown,
        explanationWorker: explainForWorker(scoreBreakdown, job),
        explanationEmployer: explainForEmployer(scoreBreakdown, worker),
        engineVersion,
        weightsVersion: weights.version,
      };

      candidates.push({ pair: { workerId: worker.id, jobId: job.id, priority }, candidate });
    }
  }

  const workerQuotas = new Map(workers.map((w) => [w.id, quotas.workerDaily]));
  const jobQuotas = new Map(activeJobs.map((j) => [j.id, quotas.jobPerCycle]));

  const allocated = allocate({
    candidatePairs: candidates.map((c) => c.pair),
    workerQuotas,
    jobQuotas,
    defaultWorkerQuota: quotas.workerDaily,
    defaultJobQuota: quotas.jobPerCycle,
  });

  const allocatedKeys = new Set(allocated.map((p) => pairKey(p.workerId, p.jobId)));
  const matches = candidates
    .filter((c) => allocatedKeys.has(pairKey(c.pair.workerId, c.pair.jobId)))
    .map((c) => c.candidate)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    matches,
    stats: {
      workersEvaluated: workers.length,
      jobsEvaluated: activeJobs.length,
      pairsScored,
      pairsPassedKnockout,
      pairsAboveThreshold: candidates.length,
      matchesCreated: matches.length,
    },
  };
}
