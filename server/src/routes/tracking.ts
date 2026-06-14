import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getAppConfig } from "../lib/app-config.js";

export const trackingRouter = Router();

trackingRouter.get("/tracking", async (_req: Request, res: Response) => {
  const config = await getAppConfig();
  res.json({
    facebookPixelIds: config.facebookPixelIds,
    googleAnalyticsIds: config.googleAnalyticsIds,
    welcomeMessage: config.welcomeMessage ||
      "Bienvenue ! Je suis l'assistant Orgonite Tunisie. Comment puis-je vous aider ?",
  });
});

trackingRouter.get("/track-visit", async (req: Request, res: Response) => {
  try {
    const rawKey = req.query.session || req.ip || "unknown";
    const sessionKey = String(rawKey).slice(0, 64);
    const pageUrl = (req.query.url as string) || "/";

    await supabase.from("page_views").insert({
      session_key: sessionKey,
      is_admin: false,
      page_url: pageUrl,
    });

    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});
