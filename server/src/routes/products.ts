import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/auth.js";
import { getLegacyProducts } from "../lib/legacy-config.js";
import { formatProduct } from "../lib/product-format.js";

export const productsRouter = Router();

// Public: list visible products
productsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const isAdminMount = _req.baseUrl.includes("/api/admin/");
    let query = supabase
      .from("products")
      .select("*");

    if (!isAdminMount) {
      query = query.eq("visible", true);
    }

    const { data, error } = await query.order(isAdminMount ? "created_at" : "name", {
      ascending: !isAdminMount,
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json((data || []).map(formatProduct));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all products
productsRouter.get("/admin", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(formatProduct));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: create product
productsRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.id || !body.name) {
      return res.status(400).json({ error: "id et name requis" });
    }

    const product = {
      id: body.id,
      name: body.name,
      slug: body.slug || body.id.replace(/_/g, "-"),
      price: parseFloat(body.price) || 0,
      currency: body.currency || "DT",
      image_url: body.imageUrl || "",
      benefits: body.benefits || "",
      composition: body.composition || "",
      taille: body.taille || "",
      accent_color: body.accentColor || "#7c3aed",
      product_type: body.productType || "",
      welcome_sequence: JSON.stringify(body.welcomeSequence || []),
      stock: parseInt(body.stock) || 10,
      hook: body.hook || "",
      hook_transition: body.hookTransition || "",
      upsell_price: body.upsellPrice !== undefined ? parseFloat(body.upsellPrice) : null,
      price_original: body.priceOriginal !== undefined ? parseFloat(body.priceOriginal) : null,
      faq: JSON.stringify(body.faq || []),
      reviews: JSON.stringify(body.reviews || []),
      visible: body.visible !== false,
    };

    const { error } = await supabase.from("products").insert(product);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, id: body.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update product
productsRouter.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: "Corps vide" });
    }

    const fieldMap: Record<string, string> = {
      name: "name",
      slug: "slug",
      price: "price",
      currency: "currency",
      imageUrl: "image_url",
      benefits: "benefits",
      composition: "composition",
      taille: "taille",
      accentColor: "accent_color",
      productType: "product_type",
      welcomeSequence: "welcome_sequence",
      stock: "stock",
      hook: "hook",
      hookTransition: "hook_transition",
      upsellPrice: "upsell_price",
      priceOriginal: "price_original",
      faq: "faq",
      reviews: "reviews",
      visible: "visible",
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (body[camel] !== undefined) {
        let val = body[camel];
        if (["welcomeSequence", "faq", "reviews"].includes(camel)) {
          val = JSON.stringify(val);
        } else if (["price", "upsellPrice", "priceOriginal"].includes(camel)) {
          val = val !== null ? parseFloat(val) : null;
        } else if (camel === "stock") {
          val = parseInt(val);
        } else if (camel === "visible") {
          val = val ? true : false;
        }
        updates[snake] = val;
      }
    }

    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete product
productsRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: sync products from config
productsRouter.post("/sync", requireAdmin, async (req: Request, res: Response) => {
  try {
    const configProducts = req.body?.products?.length ? req.body.products : getLegacyProducts();
    if (!configProducts?.length) {
      return res.status(400).json({ error: "Aucun produit a synchroniser" });
    }

    let imported = 0;
    for (const p of configProducts) {
      if (!p.id) continue;

      const slug = p.slug || p.id.replace(/_/g, "-");
      let existing: any = null;
      try { existing = await supabase.from("products").select("id").eq("id", p.id).single(); } catch {}

      const productData = {
        id: p.id,
        name: p.name || p.id,
        slug,
        price: parseFloat(p.price) || 0,
        currency: p.currency || "DT",
        image_url: p.imageUrl || "",
        benefits: p.benefits || "",
        composition: p.composition || "",
        taille: p.taille || "",
        accent_color: p.accentColor || "#7c3aed",
        product_type: p.productType || "",
        welcome_sequence: JSON.stringify(p.welcomeSequence || []),
        stock: parseInt(p.stock) || 10,
        hook: p.hook || "",
        hook_transition: p.hook_transition || "",
        upsell_price: p.upsellPrice !== undefined ? parseFloat(p.upsellPrice) : null,
        price_original: p.priceOriginal !== undefined ? parseFloat(p.priceOriginal) : null,
        faq: JSON.stringify(p.faq || []),
        reviews: JSON.stringify(p.reviews || []),
        visible: p.visible !== false,
      };

      if (existing?.data) {
        const { error } = await supabase
          .from("products")
          .update({ ...productData, updated_at: new Date().toISOString() })
          .eq("id", p.id);
        if (!error) imported++;
      } else {
        const { error } = await supabase.from("products").insert(productData);
        if (!error) imported++;
      }
    }

    res.json({ success: true, imported });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
