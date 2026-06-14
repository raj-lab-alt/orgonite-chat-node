import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/auth.js";

export const servicesRouter = Router();

// Public: list visible services
servicesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const isAdminMount = _req.baseUrl.includes("/api/admin/");
    let query = supabase
      .from("services")
      .select("*, service_products(product_id)");

    if (!isAdminMount) {
      query = query.eq("visible", true);
    }

    const { data, error } = await query.order(isAdminMount ? "created_at" : "name", {
      ascending: !isAdminMount,
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(formatService));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all services
servicesRouter.get("/admin", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*, service_products(product_id)")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(formatService));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: create service
servicesRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
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

    const { error } = await supabase.from("services").insert(service);
    if (error) return res.status(500).json({ error: error.message });

    // Link products if provided
    if (body.productIds?.length) {
      const links = body.productIds.map((pid: string) => ({
        service_id: body.id,
        product_id: pid,
      }));
      const { error: linkErr } = await supabase.from("service_products").insert(links);
      if (linkErr) return res.status(500).json({ error: linkErr.message });
    }

    res.json({ success: true, id: body.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update service
servicesRouter.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: "Corps vide" });
    }

    const fieldMap: Record<string, string> = {
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (body[camel] !== undefined) {
        let val = body[camel];
        if (["price", "originalPrice"].includes(camel)) {
          val = val !== null ? parseFloat(val) : null;
        } else if (camel === "visible") {
          val = val ? true : false;
        }
        updates[snake] = val;
      }
    }

    const { error } = await supabase
      .from("services")
      .update(updates)
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Update linked products
    if (body.productIds && Array.isArray(body.productIds)) {
      const { error: delErr } = await supabase.from("service_products").delete().eq("service_id", req.params.id);
      if (delErr) return res.status(500).json({ error: delErr.message });
      if (body.productIds.length > 0) {
        const links = body.productIds.map((pid: string) => ({
          service_id: req.params.id,
          product_id: pid,
        }));
        const { error: insErr } = await supabase.from("service_products").insert(links);
        if (insErr) return res.status(500).json({ error: insErr.message });
      }
    }

    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete service
servicesRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function formatService(row: any) {
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
    productIds: row.productIds || (row.service_products || []).map((sp: any) => sp.product_id),
    visible: row.visible !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
