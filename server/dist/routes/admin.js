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
const zod_1 = require("zod");
const supabase_js_1 = require("../lib/supabase.js");
const auth_js_1 = require("../middleware/auth.js");
const admin_auth_js_1 = require("../lib/admin-auth.js");
const app_config_js_1 = require("../lib/app-config.js");
const logger_js_1 = require("../lib/logger.js");
const configSchema = zod_1.z.object({
    systemPrompt: zod_1.z.string().min(1).max(50000).optional(),
    catalogItemTemplate: zod_1.z.string().min(1).max(10000).optional(),
    welcomeMessage: zod_1.z.string().min(1).max(5000).optional(),
    facebookPixelIds: zod_1.z.array(zod_1.z.string().min(1).max(100)).max(20).optional(),
    googleAnalyticsIds: zod_1.z.array(zod_1.z.string().min(1).max(100)).max(20).optional(),
    statuses: zod_1.z.array(zod_1.z.string().min(1).max(50)).min(1).max(50).optional(),
    apiKeys: zod_1.z.array(zod_1.z.string().min(10).max(500)).max(10).optional(),
    models: zod_1.z.array(zod_1.z.string().min(1).max(100)).min(1).max(20).optional(),
});
exports.adminRouter = (0, express_1.Router)();
async function loadAdminProducts() {
    const { data } = await supabase_js_1.supabase
        .from("products")
        .select("*")
        .order("name");
    return data || [];
}
async function buildConfigResponse() {
    const [config, products] = await Promise.all([
        (0, app_config_js_1.getAppConfig)(),
        loadAdminProducts().catch(() => []),
    ]);
    return {
        systemPrompt: config.systemPrompt,
        _promptSource: config.source,
        apiKeys: (0, app_config_js_1.maskApiKeys)(config.geminiApiKeys),
        _apiKeyCount: config.geminiApiKeys.length,
        models: config.geminiModels,
        catalogItemTemplate: config.catalogItemTemplate,
        welcomeMessage: config.welcomeMessage,
        facebookPixelIds: config.facebookPixelIds,
        googleAnalyticsIds: config.googleAnalyticsIds,
        products,
        statuses: config.statuses,
    };
}
exports.adminRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!password) {
            return res.status(400).json({ error: "Mot de passe requis" });
        }
        if (!email) {
            const configuredPassword = (0, admin_auth_js_1.adminPassword)();
            if (!configuredPassword) {
                return res.status(500).json({ error: "ADMIN_PASSWORD non configure" });
            }
            if (!(0, admin_auth_js_1.verifyAdminPassword)(password)) {
                return res.status(401).json({ error: "Identifiants invalides" });
            }
            return res.json({ token: (0, admin_auth_js_1.adminToken)(), user: { role: "admin" } });
        }
        const { data, error } = await supabase_js_1.supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error)
            return res.status(401).json({ error: "Identifiants invalides" });
        if (!(0, admin_auth_js_1.isSupabaseAdminUser)(data.user)) {
            return res.status(403).json({ error: "Acces admin refuse" });
        }
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
        res.json(await buildConfigResponse());
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.adminRouter.put("/config", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const parsed = configSchema.parse(req.body);
        const update = {};
        if (parsed.systemPrompt !== undefined)
            update.systemPrompt = parsed.systemPrompt;
        if (parsed.catalogItemTemplate !== undefined)
            update.catalogItemTemplate = parsed.catalogItemTemplate;
        if (parsed.welcomeMessage !== undefined)
            update.welcomeMessage = parsed.welcomeMessage;
        if (parsed.facebookPixelIds !== undefined)
            update.facebookPixelIds = parsed.facebookPixelIds;
        if (parsed.googleAnalyticsIds !== undefined)
            update.googleAnalyticsIds = parsed.googleAnalyticsIds;
        if (parsed.statuses !== undefined)
            update.statuses = parsed.statuses;
        if (parsed.apiKeys !== undefined)
            update.geminiApiKeys = parsed.apiKeys;
        if (parsed.models !== undefined)
            update.geminiModels = parsed.models;
        await (0, app_config_js_1.updateAppConfig)(update);
        res.json(await buildConfigResponse());
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Validation echouee", details: err.errors });
        }
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
        const { data: pageViews } = await supabase_js_1.supabase
            .from("page_views")
            .select("session_key")
            .eq("is_admin", false)
            .gte("created_at", since);
        const uniqueVisitors = new Set((pageViews || []).map((row) => row.session_key).filter(Boolean)).size;
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
        logger_js_1.logger.error("Stats error", { error: err.message });
        res.status(500).json({ error: "Erreur lors du chargement des statistiques" });
    }
});
exports.adminRouter.post("/migrate-schema", auth_js_1.requireAdmin, async (_req, res) => {
    try {
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
        if (!fs.existsSync(migrationsDir)) {
            return res.status(404).json({ error: "Dossier migrations introuvable" });
        }
        const sql = fs.readdirSync(migrationsDir)
            .filter((file) => file.endsWith(".sql"))
            .sort()
            .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf-8"))
            .join("\n\n");
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
        res.json({ success: true, message: "Migrations executed" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//# sourceMappingURL=admin.js.map