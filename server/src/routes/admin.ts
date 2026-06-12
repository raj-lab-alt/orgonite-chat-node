import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/auth.js";
import { adminPassword, adminToken } from "../lib/admin-auth.js";
import { getLegacyConfig, getLegacyProducts, getLegacyStatuses } from "../lib/legacy-config.js";

export const adminRouter = Router();

adminRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Mot de passe requis" });
    }

    if (!email) {
      if (password !== adminPassword()) {
        return res.status(401).json({ error: "Identifiants invalides" });
      }
      return res.json({ token: adminToken(), user: { role: "admin" } });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return res.status(401).json({ error: "Identifiants invalides" });

    res.json({
      token: data.session?.access_token,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get("/check", requireAdmin, (_req: Request, res: Response) => {
  res.json({ valid: true, user: (_req as any).user });
});

adminRouter.get("/config", requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Read system prompt from file
    const fs = await import("fs");
    const path = await import("path");
    const promptFile = path.resolve(__dirname, "../../prompt-amine-structure.txt");

    let systemPrompt = "";
    let promptSource = "config";

    if (fs.existsSync(promptFile)) {
      systemPrompt = fs.readFileSync(promptFile, "utf-8");
      promptSource = "file";
    }

    let products: any[] = [];
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name");
      products = data || [];
    } catch {}

    const legacyConfig = getLegacyConfig();
    const legacyStatuses = getLegacyStatuses();

    res.json({
      systemPrompt,
      _promptSource: promptSource,
      apiKeys: (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean).map(() => "***"),
      _apiKeyCount: (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean).length,
      models: (process.env.GEMINI_MODELS || "gemini-2.5-flash").split(",").filter(Boolean),
      catalogItemTemplate: legacyConfig.catalogItemTemplate || "{n}. {name} [RENDER_PRODUCT:{id}] : {benefits} Composition : {composition} Prix : {price} {currency}.",
      welcomeMessage: process.env.WELCOME_MESSAGE || legacyConfig.welcomeMessage || "",
      facebookPixelIds: [process.env.FACEBOOK_PIXEL_ID].filter(Boolean).length
        ? [process.env.FACEBOOK_PIXEL_ID].filter(Boolean)
        : (legacyConfig.facebookPixelIds || []),
      googleAnalyticsIds: [process.env.GA4_ID].filter(Boolean).length
        ? [process.env.GA4_ID].filter(Boolean)
        : (legacyConfig.googleAnalyticsIds || []),
      products: products.length ? products : getLegacyProducts(),
      statuses: legacyStatuses.length ? legacyStatuses : [
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put("/config", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // If systemPrompt provided, write to prompt file
    if (body.systemPrompt) {
      const fs = await import("fs");
      const path = await import("path");
      const promptFile = path.resolve(__dirname, "../../prompt-amine-structure.txt");
      fs.writeFileSync(promptFile, body.systemPrompt, "utf-8");
    }

    // Statuses are stored in env or config table
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || "30")));
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Conversations stats
    const { data: conversations } = await supabase
      .from("conversation_stats")
      .select("*")
      .gte("created_at", since);

    // Orders stats
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .not("statut", "eq", "corbeille")
      .gte("date", since);

    // Page views
    const { count: uniqueVisitors } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", false)
      .gte("created_at", since);

    const totalOrders = orders?.length || 0;
    const deliveredOrders = orders?.filter((o) => o.statut === "livree").length || 0;
    const failedOrders = orders?.filter((o) =>
      ["annule", "injoignable", "non qualifie", "echouer"].includes(o.statut)
    ).length || 0;
    const revenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_commande || "0"), 0) || 0;
    const sessions = conversations?.length || 0;
    const totalMessages = conversations?.reduce((sum, c) => sum + (c.messages_count || 0), 0) || 0;

    // Mode breakdown
    const modeBreakdown: Record<string, number> = {};
    for (const c of conversations || []) {
      modeBreakdown[c.mode] = (modeBreakdown[c.mode] || 0) + 1;
    }

    // Top products
    const productCounts: Record<string, { count: number; delivered: number; revenue: number }> = {};
    for (const o of orders || []) {
      const prod = o.produit || "Inconnu";
      if (!productCounts[prod]) productCounts[prod] = { count: 0, delivered: 0, revenue: 0 };
      productCounts[prod].count++;
      if (o.statut === "livree") productCounts[prod].delivered++;
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
        visitor_to_conversation_rate:
          uniqueVisitors ? Math.round((sessions / uniqueVisitors) * 1000) / 10 : 0,
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
  } catch (err: any) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des statistiques" });
  }
});

adminRouter.post("/migrate-schema", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const fs = await import("fs");
    const path = await import("path");

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

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: text });
    }

    res.json({ success: true, message: "Migration executed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
