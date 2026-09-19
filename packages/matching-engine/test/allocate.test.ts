import { describe, expect, it } from "vitest";
import { allocate, type ScoredPair } from "../src/allocate";

function pair(workerId: string, jobId: string, priority: number): ScoredPair {
  return { workerId, jobId, priority };
}

describe("allocate", () => {
  it("never gives a worker more than its daily quota", () => {
    const pairs: ScoredPair[] = [];
    for (let j = 0; j < 10; j++) {
      pairs.push(pair("w1", `j${j}`, Math.random()));
    }
    const result = allocate({
      candidatePairs: pairs,
      workerQuotas: new Map([["w1", 3]]),
      jobQuotas: new Map(),
      defaultJobQuota: 5,
    });
    const forWorker = result.filter((r) => r.workerId === "w1");
    expect(forWorker.length).toBeLessThanOrEqual(3);
  });

  it("never gives a job more than its per-cycle quota", () => {
    const pairs: ScoredPair[] = [];
    for (let w = 0; w < 20; w++) {
      pairs.push(pair(`w${w}`, "j1", Math.random()));
    }
    const result = allocate({
      candidatePairs: pairs,
      workerQuotas: new Map(),
      jobQuotas: new Map([["j1", 5]]),
      defaultWorkerQuota: 3,
    });
    const forJob = result.filter((r) => r.jobId === "j1");
    expect(forJob.length).toBeLessThanOrEqual(5);
  });

  it("produces a stable allocation — no pair prefers each other over their assignment", () => {
    // Two workers, two jobs, quota 1 each. w1 prefers j1, w2 prefers j1 too,
    // but j1 (quota 1) should end up with whichever has higher priority for it,
    // and the loser should land on j2 if it proposed there.
    const pairs: ScoredPair[] = [
      pair("w1", "j1", 0.9),
      pair("w1", "j2", 0.5),
      pair("w2", "j1", 0.95),
      pair("w2", "j2", 0.4),
    ];
    const result = allocate({
      candidatePairs: pairs,
      workerQuotas: new Map([["w1", 1], ["w2", 1]]),
      jobQuotas: new Map([["j1", 1], ["j2", 1]]),
    });

    const w2j1 = result.find((r) => r.workerId === "w2" && r.jobId === "j1");
    expect(w2j1).toBeDefined(); // w2 has higher priority for j1, must win it

    const w1Result = result.find((r) => r.workerId === "w1");
    expect(w1Result?.jobId).toBe("j2"); // w1 falls back to its next choice
  });

  it("handles an empty input without throwing", () => {
    const result = allocate({ candidatePairs: [], workerQuotas: new Map(), jobQuotas: new Map() });
    expect(result).toEqual([]);
  });
});
