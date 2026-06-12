import { Router, Request, Response } from "express";

export const trackingRouter = Router();

trackingRouter.get("/tracking", (_req: Request, res: Response) => {
  res.json({
    facebook_pixel_id: process.env.FACEBOOK_PIXEL_ID || null,
    ga4_id: process.env.GA4_ID || null,
    welcome_message: process.env.WELCOME_MESSAGE || "Bienvenue !",
  });
});

trackingRouter.get("/track-visit", (_req: Request, res: Response) => {
  // TODO: log visit to Supabase
  res.json({ success: true });
});
