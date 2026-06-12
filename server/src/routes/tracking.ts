import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getLegacyConfig } from "../lib/legacy-config.js";

export const trackingRouter = Router();

trackingRouter.get("/tracking", (_req: Request, res: Response) => {
  const legacyConfig = getLegacyConfig();
  res.json({
    facebookPixelIds: [process.env.FACEBOOK_PIXEL_ID].filter(Boolean).length
      ? [process.env.FACEBOOK_PIXEL_ID].filter(Boolean)
      : (legacyConfig.facebookPixelIds || []),
    googleAnalyticsIds: [process.env.GA4_ID].filter(Boolean).length
      ? [process.env.GA4_ID].filter(Boolean)
      : (legacyConfig.googleAnalyticsIds || []),
    welcomeMessage:
      process.env.WELCOME_MESSAGE ||
      legacyConfig.welcomeMessage ||
      "Bienvenue ! Je suis l'assistant Orgonite Tunisie. Comment puis-je vous aider ?",
  });
});

trackingRouter.get("/track-visit", async (req: Request, res: Response) => {
  try {
    const sessionKey = req.query.session || req.ip || "unknown";
    const pageUrl = (req.query.url as string) || "/";

    await supabase.from("page_views").insert({
      session_key: String(sessionKey),
      is_admin: false,
      page_url: pageUrl,
    });

    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});
