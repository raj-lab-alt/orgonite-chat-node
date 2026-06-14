"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAttempt = recordAttempt;
exports.getModelStats = getModelStats;
exports.clearStats = clearStats;
const maxRecords = 5000;
const records = [];
function recordAttempt(data) {
    records.push({ ...data, timestamp: Date.now() });
    if (records.length > maxRecords) {
        records.splice(0, records.length - maxRecords);
    }
}
function getModelStats() {
    if (records.length === 0) {
        return { models: [], keys: [], totalRequests: 0 };
    }
    const modelMap = new Map();
    const keyMap = new Map();
    for (const r of records) {
        let ms = modelMap.get(r.model);
        if (!ms) {
            ms = { requests: 0, successes: 0, wins: 0, totalLatency: 0 };
            modelMap.set(r.model, ms);
        }
        ms.requests++;
        if (r.success)
            ms.successes++;
        if (r.winner)
            ms.wins++;
        ms.totalLatency += r.latencyMs;
        let ks = keyMap.get(r.keyIndex);
        if (!ks) {
            ks = { requests: 0, successes: 0, totalLatency: 0 };
            keyMap.set(r.keyIndex, ks);
        }
        ks.requests++;
        if (r.success)
            ks.successes++;
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
function clearStats() {
    records.length = 0;
}
//# sourceMappingURL=gemini-stats.js.map