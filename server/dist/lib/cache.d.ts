export declare function cacheGet<T>(key: string): T | undefined;
export declare function cacheSet<T>(key: string, value: T, ttlMs?: number): void;
export declare function cacheDel(key: string): void;
export declare function cacheClear(): void;
export declare function memoize<T>(key: string, fetch: () => Promise<T>, ttlMs?: number): Promise<T>;
//# sourceMappingURL=cache.d.ts.map