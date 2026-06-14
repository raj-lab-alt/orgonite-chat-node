interface AttemptRecord {
    model: string;
    keyIndex: number;
    success: boolean;
    winner: boolean;
    latencyMs: number;
    timestamp: number;
}
export declare function recordAttempt(data: Omit<AttemptRecord, "timestamp">): void;
export declare function getModelStats(): {
    models: never[];
    keys: never[];
    totalRequests: number;
    periodSec?: undefined;
} | {
    models: {
        model: string;
        requests: number;
        successRate: number;
        winRate: number;
        avgLatencyMs: number;
    }[];
    keys: {
        keyIndex: number;
        requests: number;
        successRate: number;
        avgLatencyMs: number;
    }[];
    totalRequests: number;
    periodSec: number;
};
export declare function clearStats(): void;
export {};
//# sourceMappingURL=gemini-stats.d.ts.map