"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("../lib/supabase.js");
exports.trackingRouter = (0, express_1.Router)();
exports.trackingRouter.get("/tracking", (_req, res) => {
    res.json({
        facebookPixelIds: [process.env.FACEBOOK_PIXEL_ID].filter(Boolean),
        googleAnalyticsIds: [process.env.GA4_ID].filter(Boolean),
        welcomeMessage: process.env.WELCOME_MESSAGE ||
            "Bienvenue ! Je suis l'assistant Orgonite Tunisie. Comment puis-je vous aider ?",
    });
});
exports.trackingRouter.get("/track-visit", async (req, res) => {
    try {
        const sessionKey = req.query.session || req.ip || "unknown";
        const pageUrl = req.query.url || "/";
        await supabase_js_1.supabase.from("page_views").insert({
            session_key: String(sessionKey),
            is_admin: false,
            page_url: pageUrl,
        });
        res.json({ ok: true });
    }
    catch {
        res.json({ ok: true });
    }
});
//# sourceMappingURL=tracking.js.map