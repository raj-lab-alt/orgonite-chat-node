import { supabase } from "../lib/supabase.js";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

export async function checkRateLimit(
  maxRequests = MAX_REQUESTS,
  windowSeconds = WINDOW_SECONDS
): Promise<void> {
  try {
    const ip =
      (globalThis as any).__requestIp || "unknown";

    const now = new Date().toISOString();
    const resetAt = new Date(
      Date.now() + windowSeconds * 1000
    ).toISOString();

    // Clean expired entries
    await supabase.from("rate_limits").delete().lte("reset_at", now);

    // Get existing
    const { data } = await supabase
      .from("rate_limits")
      .select("count, reset_at")
      .eq("ip", ip)
      .single();

    if (data) {
      if (data.count >= maxRequests) {
        const err = new Error("Trop de requetes. Veuillez reessayer plus tard.");
        (err as any).statusCode = 429;
        throw err;
      }
      await supabase
        .from("rate_limits")
        .update({ count: data.count + 1, reset_at: data.reset_at })
        .eq("ip", ip);
    } else {
      await supabase
        .from("rate_limits")
        .insert({ ip, count: 1, reset_at: resetAt });
    }
  } catch (err: any) {
    if (err.statusCode === 429) throw err;
    // Silence rate limit errors — don't block traffic
  }
}
