"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDel = cacheDel;
exports.cacheClear = cacheClear;
exports.memoize = memoize;
const store = new Map();
const DEFAULT_TTL_MS = 60_000;
function cacheGet(key) {
    const entry = store.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.value;
}
function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
function cacheDel(key) {
    store.delete(key);
}
function cacheClear() {
    store.clear();
}
function memoize(key, fetch, ttlMs = DEFAULT_TTL_MS) {
    const cached = cacheGet(key);
    if (cached !== undefined)
        return Promise.resolve(cached);
    return fetch().then((value) => {
        cacheSet(key, value, ttlMs);
        return value;
    });
}
//# sourceMappingURL=cache.js.map