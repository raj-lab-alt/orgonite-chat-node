"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("../lib/supabase.js");
const auth_js_1 = require("../middleware/auth.js");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email et mot de passe requis" });
        }
        const { data, error } = await supabase_js_1.supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error)
            return res.status(401).json({ error: "Identifiants invalides" });
        res.json({
            token: data.session?.access_token,
            user: {
                id: data.user?.id,
                email: data.user?.email,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.adminRouter.get("/check", auth_js_1.requireAdmin, (_req, res) => {
    res.json({ valid: true, user: _req.user });
});
exports.adminRouter.get("/config", auth_js_1.requireAdmin, async (_req, res) => {
    try {
        // Read system prompt from file
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const promptFile = path.resolve(__dirname, "../../prompt-amine-structure.txt");
        let systemPrompt = "";
        let promptSource = "config";
        if (fs.existsSync(promptFile)) {
            systemPrompt = fs.readFileSync(promptFile, "utf-8");
            promptSource = "file";
        }
        // Read from products table for catalog
        const { data: products } = await supabase_js_1.supabase
            .from("products")
            .select("*")
            .order("name");
        res.json({
            systemPrompt,
            _promptSource: promptSource,
            apiKeys: (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean).map(() => "***"),
            _apiKeyCount: (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean).length,
            models: (process.env.GEMINI_MODELS || "gemini-2.5-flash").split(",").filter(Boolean),
            facebookPixelIds: [process.env.FACEBOOK_PIXEL_ID].filter(Boolean),
            googleAnalyticsIds: [process.env.GA4_ID].filter(Boolean),
            products: products || [],
            statuses: [
                "attente de confirm tel",
                "cde double",
                "a expedier",
                "injoignable",
                "confirmee att. env.",
                "livree",
                "echouee",
                "nn qualifiee",
                "Annulee",
            ],
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.adminRouter.put("/config", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const body = req.body;
        // If systemPrompt provided, write to prompt file
        if (body.systemPrompt) {
            const fs = await Promise.resolve().then(() => __importStar(require("fs")));
            const path = await Promise.resolve().then(() => __importStar(require("path")));
            const promptFile = path.resolve(__dirname, "../../prompt-amine-structure.txt");
            fs.writeFileSync(promptFile, body.systemPrompt, "utf-8");
        }
        // Statuses are stored in env or config table
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.adminRouter.get("/stats", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const days = Math.max(1, Math.min(90, parseInt(req.query.days || "30")));
        const since = new Date(Date.now() - days * 86400000).toISOString();
        // Conversations stats
        const { data: conversations } = await supabase_js_1.supabase
            .from("conversation_stats")
            .select("*")
            .gte("created_at", since);
        // Orders stats
        const { data: orders } = await supabase_js_1.supabase
            .from("orders")
            .select("*")
            .not("statut", "eq", "corbeille")
            .gte("date", since);
        // Page views
        const { count: uniqueVisitors } = await supabase_js_1.supabase
            .from("page_views")
            .select("*", { count: "exact", head: true })
            .eq("is_admin", false)
            .gte("created_at", since);
        const totalOrders = orders?.length || 0;
        const deliveredOrders = orders?.filter((o) => o.statut === "livree").length || 0;
        const failedOrders = orders?.filter((o) => ["annule", "injoignable", "non qualifie", "echouer"].includes(o.statut)).length || 0;
        const revenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_commande || "0"), 0) || 0;
        const sessions = conversations?.length || 0;
        const totalMessages = conversations?.reduce((sum, c) => sum + (c.messages_count || 0), 0) || 0;
        // Mode breakdown
        const modeBreakdown = {};
        for (const c of conversations || []) {
            modeBreakdown[c.mode] = (modeBreakdown[c.mode] || 0) + 1;
        }
        // Top products
        const productCounts = {};
        for (const o of orders || []) {
            const prod = o.produit || "Inconnu";
            if (!productCounts[prod])
                productCounts[prod] = { count: 0, delivered: 0, revenue: 0 };
            productCounts[prod].count++;
            if (o.statut === "livree")
                productCounts[prod].delivered++;
            productCounts[prod].revenue += parseFloat(o.total_commande || "0");
        }
        const topProducts = Object.entries(productCounts)
            .sort(([, a], [, b]) => b.revenue - a.revenue)
            .slice(0, 10)
            .map(([produit, stats]) => ({
            produit,
            orders_count: stats.count,
            delivered_count: stats.delivered,
            revenue: stats.revenue,
            avg_value: stats.count > 0 ? stats.revenue / stats.count : 0,
            delivery_rate: stats.count > 0 ? Math.round((stats.delivered / stats.count) * 100) : 0,
        }));
        res.json({
            period: days,
            summary: {
                sessions,
                total_conversations: sessions,
                total_messages: totalMessages,
                unique_visitors: uniqueVisitors || 0,
                visitor_to_conversation_rate: uniqueVisitors ? Math.round((sessions / uniqueVisitors) * 1000) / 10 : 0,
                total_commandes: totalOrders,
                ca_total: revenue,
                avg_order_value: totalOrders > 0 ? revenue / totalOrders : 0,
                avg_messages_to_order: totalOrders > 0 ? Math.round(totalMessages / totalOrders * 10) / 10 : 0,
                avg_messages: sessions > 0 ? Math.round(totalMessages / sessions * 10) / 10 : 0,
            },
            modes: Object.entries(modeBreakdown).map(([mode, total]) => ({ mode, total })),
            topProducts,
            orderStats: {
                total_orders: totalOrders,
                delivered_orders: deliveredOrders,
                failed_orders: failedOrders,
                orders_revenue: revenue,
                avg_order_value: totalOrders > 0 ? revenue / totalOrders : 0,
                delivery_rate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
            },
        });
    }
    catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Erreur lors du chargement des statistiques" });
    }
});
exports.adminRouter.post("/migrate-schema", auth_js_1.requireAdmin, async (_req, res) => {
    try {
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const sqlPath = path.resolve(__dirname, "../../supabase/migrations/001_initial_schema.sql");
        if (!fs.existsSync(sqlPath)) {
            return res.status(404).json({ error: "Fichier migration introuvable" });
        }
        const sql = fs.readFileSync(sqlPath, "utf-8");
        const mgmtToken = process.env.SUPABASE_MGMT_TOKEN;
        const ref = process.env.SUPABASE_REF;
        if (!mgmtToken || !ref) {
            return res.status(500).json({ error: "SUPABASE_MGMT_TOKEN et SUPABASE_REF requis" });
        }
        const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${mgmtToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: sql }),
        });
        if (!response.ok) {
            const text = await response.text();
            return res.status(500).json({ error: text });
        }
        res.json({ success: true, message: "Migration executed" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//# sourceMappingURL=admin.js.map