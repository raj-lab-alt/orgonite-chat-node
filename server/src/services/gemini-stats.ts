interface AttemptRecord {
  model: string;
  keyIndex: number;
  success: boolean;
  winner: boolean;
  latencyMs: number;
  timestamp: number;
}

const maxRecords = 5000;
const records: AttemptRecord[] = [];

export function recordAttempt(data: Omit<AttemptRecord, "timestamp">) {
  records.push({ ...data, timestamp: Date.now() });
  if (records.length > maxRecords) {
    records.splice(0, records.length - maxRecords);
  }
}

export function getModelStats() {
  if (records.length === 0) {
    return { models: [], keys: [], totalRequests: 0 };
  }

  const modelMap = new Map<
    string,
    { requests: number; successes: number; wins: number; totalLatency: number }
  >();
  const keyMap = new Map<
    number,
    { requests: number; successes: number; totalLatency: number }
  >();

  for (const r of records) {
    let ms = modelMap.get(r.model);
    if (!ms) {
      ms = { requests: 0, successes: 0, wins: 0, totalLatency: 0 };
      modelMap.set(r.model, ms);
    }
    ms.requests++;
    if (r.success) ms.successes++;
    if (r.winner) ms.wins++;
    ms.totalLatency += r.latencyMs;

    let ks = keyMap.get(r.keyIndex);
    if (!ks) {
      ks = { requests: 0, successes: 0, totalLatency: 0 };
      keyMap.set(r.keyIndex, ks);
    }
    ks.requests++;
    if (r.success) ks.successes++;
    ks.totalLatency += r.latencyMs;
  }

  const models = Array.from(modelMap.entries()).map(([model, d]) => ({
    model,
    requests: d.requests,
    successRate: d.requests > 0 ? Math.round((d.successes / d.requests) * 100) : 0,
    winRate: d.requests > 0 ? Math.round((d.wins / d.requests) * 100) : 0,
    avgLatencyMs: d.requests > 0 ? Math.round(d.totalLatency / d.requests) : 0,
  }));

  const keys = Array.from(keyMap.entries()).map(([keyIndex, d]) => ({
    keyIndex,
    requests: d.requests,
    successRate: d.requests > 0 ? Math.round((d.successes / d.requests) * 100) : 0,
    avgLatencyMs: d.requests > 0 ? Math.round(d.totalLatency / d.requests) : 0,
  }));

  models.sort((a, b) => b.requests - a.requests);
  keys.sort((a, b) => b.requests - a.requests);

  return { models, keys, totalRequests: records.length, periodSec: 0 };
}

export function clearStats() {
  records.length = 0;
}
