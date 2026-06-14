"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRouter = void 0;
const express_1 = require("express");
const supabase_js_1 = require("../lib/supabase.js");
const auth_js_1 = require("../middleware/auth.js");
const cache_js_1 = require("../lib/cache.js");
const logger_js_1 = require("../lib/logger.js");
const SERVICE_TTL = 30_000;
async function fetchServices(isAdmin) {
    let query = supabase_js_1.supabase.from("services").select("*, service_products(product_id)");
    if (!isAdmin)
        query = query.eq("visible", true);
    const { data, error } = await query.order(isAdmin ? "created_at" : "name", { ascending: !isAdmin });
    if (error)
        throw new Error(error.message);
    return (data || []).map(formatService);
}
function invalidateServiceCache() {
    (0, cache_js_1.cacheDel)("services:admin");
    (0, cache_js_1.cacheDel)("services:public");
}
exports.servicesRouter = (0, express_1.Router)();
// Public: list visible services
exports.servicesRouter.get("/", async (_req, res) => {
    try {
        const isAdminMount = _req.baseUrl.includes("/api/admin/");
        const services = await (0, cache_js_1.memoize)(isAdminMount ? "services:admin" : "services:public", () => fetchServices(isAdminMount), SERVICE_TTL);
        res.json(services);
    }
    catch (err) {
        logger_js_1.logger.error("Failed to fetch services", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});
// Admin: list all services
exports.servicesRouter.get("/admin", auth_js_1.requireAdmin, async (_req, res) => {
    try {
        const services = await (0, cache_js_1.memoize)("services:admin", () => fetchServices(true), SERVICE_TTL);
        res.json(services);
    }
    catch (err) {
        logger_js_1.logger.error("Failed to fetch admin services", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});
// Admin: create service
exports.servicesRouter.post("/", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const body = req.body;
        if (!body.id || !body.name) {
            return res.status(400).json({ error: "id et name requis" });
        }
        const service = {
            id: body.id,
            name: body.name,
            slug: body.slug || body.id.replace(/_/g, "-"),
            subtitle: body.subtitle || "",
            price: parseFloat(body.price) || 0,
            original_price: body.originalPrice !== undefined ? parseFloat(body.originalPrice) : null,
            icon: body.icon || "🔮",
            image_url: body.imageUrl || "",
            color: body.color || "#8b5cf6",
            description: body.description || "",
            benefits: body.benefits || "",
            duration: body.duration || "",
            format: body.format || "",
            visible: body.visible !== false,
        };
        const { error } = await supabase_js_1.supabase.from("services").insert(service);
        if (error)
            return res.status(500).json({ error: error.message });
        // Link products if provided
        if (body.productIds?.length) {
            const links = body.productIds.map((pid) => ({
                service_id: body.id,
                product_id: pid,
            }));
            const { error: linkErr } = await supabase_js_1.supabase.from("service_products").insert(links);
            if (linkErr)
                return res.status(500).json({ error: linkErr.message });
        }
        invalidateServiceCache();
        res.json({ success: true, id: body.id });
    }
    catch (err) {
        logger_js_1.logger.error("Failed to create service", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});
// Admin: update service
exports.servicesRouter.put("/:id", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const body = req.body;
        if (!body || Object.keys(body).length === 0) {
            return res.status(400).json({ error: "Corps vide" });
        }
        const fieldMap = {
            name: "name",
            slug: "slug",
            subtitle: "subtitle",
            price: "price",
            originalPrice: "original_price",
            icon: "icon",
            imageUrl: "image_url",
            color: "color",
            description: "description",
            benefits: "benefits",
            duration: "duration",
            format: "format",
            visible: "visible",
        };
        const updates = { updated_at: new Date().toISOString() };
        for (const [camel, snake] of Object.entries(fieldMap)) {
            if (body[camel] !== undefined) {
                let val = body[camel];
                if (["price", "originalPrice"].includes(camel)) {
                    val = val !== null ? parseFloat(val) : null;
                }
                else if (camel === "visible") {
                    val = val ? true : false;
                }
                updates[snake] = val;
            }
        }
        const { error } = await supabase_js_1.supabase
            .from("services")
            .update(updates)
            .eq("id", req.params.id);
        if (error)
            return res.status(500).json({ error: error.message });
        // Update linked products
        if (body.productIds && Array.isArray(body.productIds)) {
            const { error: delErr } = await supabase_js_1.supabase.from("service_products").delete().eq("service_id", req.params.id);
            if (delErr)
                return res.status(500).json({ error: delErr.message });
            if (body.productIds.length > 0) {
                const links = body.productIds.map((pid) => ({
                    service_id: req.params.id,
                    product_id: pid,
                }));
                const { error: insErr } = await supabase_js_1.supabase.from("service_products").insert(links);
                if (insErr)
                    return res.status(500).json({ error: insErr.message });
            }
        }
        invalidateServiceCache();
        res.json({ success: true, id: req.params.id });
    }
    catch (err) {
        logger_js_1.logger.error("Failed to update service", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});
// Admin: delete service
exports.servicesRouter.delete("/:id", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase_js_1.supabase
            .from("services")
            .delete()
            .eq("id", req.params.id);
        if (error)
            return res.status(500).json({ error: error.message });
        invalidateServiceCache();
        res.json({ success: true, deleted: true });
    }
    catch (err) {
        logger_js_1.logger.error("Failed to delete service", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});
function formatService(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        subtitle: row.subtitle || "",
        price: parseFloat(row.price) || 0,
        originalPrice: row.original_price || row.originalPrice ? parseFloat(row.original_price ?? row.originalPrice) : null,
        icon: row.icon || "🔮",
        imageUrl: row.image_url || row.imageUrl || "",
        color: row.color || "#8b5cf6",
        description: row.description || "",
        benefits: row.benefits || "",
        duration: row.duration || "",
        format: row.format || "",
        productIds: row.productIds || (row.service_products || []).map((sp) => sp.product_id),
        visible: row.visible !== false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=services.js.map