"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const supabase_js_1 = require("../lib/supabase.js");
const logger_js_1 = require("../lib/logger.js");
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;
async function checkRateLimit(identifier = "unknown", maxRequests = MAX_REQUESTS, windowSeconds = WINDOW_SECONDS) {
    const ip = String(identifier || "unknown").slice(0, 45);
    const { data, error } = await supabase_js_1.supabase.rpc("check_rate_limit", {
        p_ip: ip,
        p_max: maxRequests,
        p_window_seconds: windowSeconds,
    });
    if (error) {
        // If RPC doesn't exist yet (migration not run), fall back to best-effort
        logger_js_1.logger.warn("RPC unavailable, using fallback", { error: error.message });
        await fallbackCheck(ip, maxRequests, windowSeconds);
        return;
    }
    if (!data?.allowed) {
        const err = new Error("Trop de requetes. Veuillez reessayer plus tard.");
        err.statusCode = 429;
        throw err;
    }
}
async function fallbackCheck(ip, maxRequests, windowSeconds) {
    try {
        const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString();
        const { data } = await supabase_js_1.supabase
            .from("rate_limits")
            .select("count, reset_at")
            .eq("ip", ip)
            .single();
        if (data) {
            if (data.count >= maxRequests) {
                const err = new Error("Trop de requetes. Veuillez reessayer plus tard.");
                err.statusCode = 429;
                throw err;
            }
            await supabase_js_1.supabase
                .from("rate_limits")
                .update({ count: data.count + 1, reset_at: data.reset_at })
                .eq("ip", ip);
        }
        else {
            await supabase_js_1.supabase.from("rate_limits").insert({ ip, count: 1, reset_at: resetAt });
        }
    }
    catch (err) {
        if (err.statusCode === 429)
            throw err;
    }
}
//# sourceMappingURL=rate-limit.js.map