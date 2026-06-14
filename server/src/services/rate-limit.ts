import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 30;

export async function checkRateLimit(
  identifier = "unknown",
  maxRequests = MAX_REQUESTS,
  windowSeconds = WINDOW_SECONDS
): Promise<void> {
  const ip = String(identifier || "unknown").slice(0, 45);

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_ip: ip,
    p_max: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // If RPC doesn't exist yet (migration not run), fall back to best-effort
    logger.warn("RPC unavailable, using fallback", { error: error.message });
    await fallbackCheck(ip, maxRequests, windowSeconds);
    return;
  }

  if (!data?.allowed) {
    const { data: rlData } = await supabase
      .from("rate_limits")
      .select("reset_at")
      .eq("ip", ip)
      .single();
    const retryAfter = rlData?.reset_at
      ? Math.max(1, Math.ceil((new Date(rlData.reset_at).getTime() - Date.now()) / 1000))
      : windowSeconds;
    const err = new Error("Trop de requetes. Veuillez reessayer plus tard.");
    (err as any).statusCode = 429;
    (err as any).retryAfter = retryAfter;
    throw err;
  }
}

async function fallbackCheck(
  ip: string,
  maxRequests: number,
  windowSeconds: number
): Promise<void> {
  try {
    const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

    const { data } = await supabase
      .from("rate_limits")
      .select("count, reset_at")
      .eq("ip", ip)
      .single();

    if (data) {
      if (data.count >= maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((new Date(data.reset_at).getTime() - Date.now()) / 1000));
        const err = new Error("Trop de requetes. Veuillez reessayer plus tard.");
        (err as any).statusCode = 429;
        (err as any).retryAfter = retryAfter;
        throw err;
      }
      await supabase
        .from("rate_limits")
        .update({ count: data.count + 1, reset_at: data.reset_at })
        .eq("ip", ip);
    } else {
      await supabase.from("rate_limits").insert({ ip, count: 1, reset_at: resetAt });
    }
  } catch (err: any) {
    if (err.statusCode === 429) throw err;
  }
}
