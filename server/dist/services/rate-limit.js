"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const supabase_js_1 = require("../lib/supabase.js");
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;
async function checkRateLimit(maxRequests = MAX_REQUESTS, windowSeconds = WINDOW_SECONDS) {
    try {
        const ip = globalThis.__requestIp || "unknown";
        const now = new Date().toISOString();
        const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString();
        // Clean expired entries
        await supabase_js_1.supabase.from("rate_limits").delete().lte("reset_at", now);
        // Get existing
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
            await supabase_js_1.supabase
                .from("rate_limits")
                .insert({ ip, count: 1, reset_at: resetAt });
        }
    }
    catch (err) {
        if (err.statusCode === 429)
            throw err;
        // Silence rate limit errors — don't block traffic
    }
}
//# sourceMappingURL=rate-limit.js.map