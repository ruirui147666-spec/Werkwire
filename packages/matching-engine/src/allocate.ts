export interface ScoredPair {
  workerId: string;
  jobId: string;
  priority: number;
}

export interface AllocationInput {
  candidatePairs: ScoredPair[];
  workerQuotas: Map<string, number>;
  jobQuotas: Map<string, number>;
  defaultWorkerQuota?: number;
  defaultJobQuota?: number;
}

/**
 * Deferred-acceptance (Gale-Shapley) allocation with two-sided quotas.
 * Workers propose in priority order; jobs hold their best offers up to
 * capacity and bump weaker ones when a stronger proposal arrives.
 */
export function allocate(input: AllocationInput): ScoredPair[] {
  const { candidatePairs, workerQuotas, jobQuotas, defaultWorkerQuota = 3, defaultJobQuota = 5 } = input;

  const byWorker = new Map<string, ScoredPair[]>();
  for (const pair of candidatePairs) {
    const list = byWorker.get(pair.workerId) ?? [];
    list.push(pair);
    byWorker.set(pair.workerId, list);
  }
  for (const list of byWorker.values()) {
    list.sort((a, b) => b.priority - a.priority);
  }

  // Pointer into each worker's sorted proposal list (how many jobs they've already tried).
  const nextProposalIndex = new Map<string, number>();
  // Current tentative holds per job, sorted ascending by priority (weakest first).
  const jobHolds = new Map<string, ScoredPair[]>();
  // Workers still needing to propose (haven't filled their quota or exhausted their list).
  const freeWorkers = new Set(byWorker.keys());
  const acceptedCount = new Map<string, number>();

  const workerQuotaOf = (id: string) => workerQuotas.get(id) ?? defaultWorkerQuota;
  const jobQuotaOf = (id: string) => jobQuotas.get(id) ?? defaultJobQuota;

  let guard = 0;
  const guardLimit = candidatePairs.length * 4 + 1000;

  while (freeWorkers.size > 0 && guard < guardLimit) {
    guard++;
    const workerId = freeWorkers.values().next().value as string;
    const proposals = byWorker.get(workerId) ?? [];
    const idx = nextProposalIndex.get(workerId) ?? 0;
    const quota = workerQuotaOf(workerId);
    const held = acceptedCount.get(workerId) ?? 0;

    if (idx >= proposals.length || held >= quota) {
      freeWorkers.delete(workerId);
      continue;
    }

    const proposal = proposals[idx];
    nextProposalIndex.set(workerId, idx + 1);

    const holds = jobHolds.get(proposal.jobId) ?? [];
    const jq = jobQuotaOf(proposal.jobId);

    if (holds.length < jq) {
      holds.push(proposal);
      holds.sort((a, b) => a.priority - b.priority);
      jobHolds.set(proposal.jobId, holds);
      acceptedCount.set(workerId, held + 1);
      if ((acceptedCount.get(workerId) ?? 0) >= quota) freeWorkers.delete(workerId);
    } else {
      const weakest = holds[0];
      if (weakest.priority < proposal.priority) {
        // bump the weakest hold, it goes back into the pool
        holds.shift();
        holds.push(proposal);
        holds.sort((a, b) => a.priority - b.priority);
        jobHolds.set(proposal.jobId, holds);

        acceptedCount.set(workerId, held + 1);
        if ((acceptedCount.get(workerId) ?? 0) >= quota) freeWorkers.delete(workerId);

        acceptedCount.set(weakest.workerId, Math.max(0, (acceptedCount.get(weakest.workerId) ?? 1) - 1));
        freeWorkers.add(weakest.workerId);
      }
      // else: proposal rejected, worker stays free and will try its next choice
    }
  }

  const result: ScoredPair[] = [];
  for (const holds of jobHolds.values()) {
    result.push(...holds);
  }
  return result.sort((a, b) => b.priority - a.priority);
}
