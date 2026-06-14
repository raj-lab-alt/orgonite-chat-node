"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("../lib/supabase.js");
const app_config_js_1 = require("../lib/app-config.js");
exports.trackingRouter = (0, express_1.Router)();
exports.trackingRouter.get("/tracking", async (_req, res) => {
    try {
        const config = await (0, app_config_js_1.getAppConfig)();
        res.json({
            facebookPixelIds: config.facebookPixelIds,
            googleAnalyticsIds: config.googleAnalyticsIds,
            welcomeMessage: config.welcomeMessage ||
                "Bienvenue ! Je suis l'assistant Orgonite Tunisie. Comment puis-je vous aider ?",
        });
    }
    catch {
        res.json({
            facebookPixelIds: [],
            googleAnalyticsIds: [],
            welcomeMessage: "Bienvenue ! Je suis l'assistant Orgonite Tunisie. Comment puis-je vous aider ?",
        });
    }
});
exports.trackingRouter.get("/track-visit", async (req, res) => {
    try {
        const rawKey = req.query.session || req.ip || "unknown";
        const sessionKey = String(rawKey).slice(0, 64);
        const pageUrl = req.query.url || "/";
        await supabase_js_1.supabase.from("page_views").insert({
            session_key: sessionKey,
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