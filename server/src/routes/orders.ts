import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/auth.js";

export const ordersRouter = Router();

const ORDER_COLUMNS = [
  "id", "nom", "telephone", "telephone2", "gouvernorat", "adresse", "produit",
  "prix_produit", "frais_livraison", "total_commande", "nombre_articles",
  "format_personnalise", "date_naissance", "signe_astrologique", "chemin_vie",
  "nombre_ame", "nombre_personnalite", "composition_personnalisee", "brief_fabrication",
  "notes", "tracking_number", "statut", "statut_avant_corbeille", "trashed_at",
  "date", "updated_at",
];

function rowToOrder(row: any) {
  return {
    id: row.id,
    nom: row.nom,
    telephone: row.telephone,
    telephone2: row.telephone2,
    gouvernorat: row.gouvernorat,
    adresse: row.adresse,
    produit: row.produit,
    prixProduit: parseFloat(row.prix_produit) || 0,
    fraisLivraison: parseFloat(row.frais_livraison) || 0,
    totalCommande: parseFloat(row.total_commande) || 0,
    nombreArticles: parseInt(row.nombre_articles) || 0,
    formatPersonnalise: row.format_personnalise || "",
    dateNaissance: row.date_naissance || "",
    signeAstrologique: row.signe_astrologique || "",
    cheminVie: row.chemin_vie || "",
    nombreAme: row.nombre_ame || "",
    nombrePersonnalite: row.nombre_personnalite || "",
    compositionPersonnalisee: row.composition_personnalisee || "",
    briefFabrication: row.brief_fabrication || "",
    notes: row.notes || "",
    trackingNumber: row.tracking_number || "",
    statut: row.statut,
    statutAvantCorbeille: row.statut_avant_corbeille || null,
    trashedAt: row.trashed_at || null,
    date: row.date,
    updatedAt: row.updated_at,
  };
}

ordersRouter.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const includeTrash = req.query.includeTrash === "1";
    let query = supabase.from("orders").select("*");

    if (!includeTrash) {
      query = query.is("trashed_at", null);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(rowToOrder));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk operations must be declared before /:id routes.
ordersRouter.put("/bulk-trash", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "IDs requis" });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({
        statut: "corbeille",
        statut_avant_corbeille: "attente de confirm tel",
        trashed_at: now,
        updated_at: now,
      })
      .in("id", ids);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

ordersRouter.put("/bulk-restore", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "IDs requis" });

    const { data: orders, error: selectError } = await supabase
      .from("orders")
      .select("id, statut_avant_corbeille")
      .in("id", ids);

    if (selectError) return res.status(500).json({ error: selectError.message });

    const now = new Date().toISOString();
    const grouped: Record<string, string[]> = {};
    for (const order of orders || []) {
      const s = order.statut_avant_corbeille || "attente de confirm tel";
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(order.id);
    }

    const results = await Promise.all(
      Object.entries(grouped).map(([statut, orderIds]) =>
        supabase
          .from("orders")
          .update({
            statut,
            statut_avant_corbeille: null,
            trashed_at: null,
            updated_at: now,
          })
          .in("id", orderIds)
      )
    );

    const error = results.find((r) => r.error)?.error;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

ordersRouter.delete("/bulk-delete", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "IDs requis" });

    const { error } = await supabase.from("orders").delete().in("id", ids);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

ordersRouter.get("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Commande introuvable" });
    res.json(rowToOrder(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

ordersRouter.put("/:id/statut", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ error: "Statut requis" });

    const { data, error } = await supabase
      .from("orders")
      .update({ statut, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(rowToOrder(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

ordersRouter.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: "Corps vide" });
    }

    // Map camelCase to snake_case for Supabase
    const colMap: Record<string, string> = {
      nom: "nom",
      telephone: "telephone",
      telephone2: "telephone2",
      gouvernorat: "gouvernorat",
      adresse: "adresse",
      produit: "produit",
      prixProduit: "prix_produit",
      fraisLivraison: "frais_livraison",
      totalCommande: "total_commande",
      nombreArticles: "nombre_articles",
      formatPersonnalise: "format_personnalise",
      dateNaissance: "date_naissance",
      signeAstrologique: "signe_astrologique",
      cheminVie: "chemin_vie",
      nombreAme: "nombre_ame",
      nombrePersonnalite: "nombre_personnalite",
      compositionPersonnalisee: "composition_personnalisee",
      briefFabrication: "brief_fabrication",
      notes: "notes",
      trackingNumber: "tracking_number",
      statut: "statut",
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [camel, snake] of Object.entries(colMap)) {
      if (body[camel] !== undefined) {
        updates[snake] = body[camel];
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(rowToOrder(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
