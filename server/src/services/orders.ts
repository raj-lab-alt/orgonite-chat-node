import { supabase } from "../lib/supabase.js";

export interface OrderData {
  id?: string;
  nom: string;
  telephone: string;
  telephone2?: string;
  gouvernorat?: string;
  adresse?: string;
  produit?: string;
  prixProduit?: number;
  fraisLivraison?: number;
  totalCommande?: number;
  nombreArticles?: number;
  formatPersonnalise?: string;
  dateNaissance?: string;
  signeAstrologique?: string;
  cheminVie?: string;
  nombreAme?: string;
  nombrePersonnalite?: string;
  compositionPersonnalisee?: string;
  briefFabrication?: string;
  notes?: string;
  statut?: string;
  remplace_commande?: string;
  fusion_avec?: string;
  [key: string]: unknown;
}

export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export function normalizeOrderPayload(data: OrderData): OrderData {
  if (data.personnalisation && typeof data.personnalisation === "object") {
    const p = data.personnalisation as Record<string, unknown>;
    if (!data.formatPersonnalise && p.forme) data.formatPersonnalise = String(p.forme);
    if (!data.dateNaissance && p.date_naissance) data.dateNaissance = String(p.date_naissance);

    const comp: string[] = [];
    if (p.cristaux) comp.push(`Cristaux: ${Array.isArray(p.cristaux) ? p.cristaux.join(", ") : p.cristaux}`);
    if (p.metaux) comp.push(`Metaux: ${Array.isArray(p.metaux) ? p.metaux.join(", ") : p.metaux}`);
    if (p.intention_gravure) comp.push(`Intention gravure: ${p.intention_gravure}`);
    if (comp.length && !data.compositionPersonnalisee) data.compositionPersonnalisee = comp.join(" | ");

    const brief: string[] = [];
    for (const key of ["prenom", "nom_naissance", "texte_cv", "texte_ame", "texte_personnalite", "signature_elementaire"]) {
      if (p[key]) brief.push(`${key}: ${p[key]}`);
    }
    if (brief.length && !data.briefFabrication) data.briefFabrication = brief.join(" | ");

    data.notes = appendNote(data.notes || "", `Personnalisation brute: ${JSON.stringify(p, null, 2)}`);
    delete data.personnalisation;
  }

  return data;
}

export function appendNote(existing: string, note: string): string {
  const trimmed = existing.trim();
  return trimmed ? `${trimmed}\n---\n${note}` : note;
}

export function calculateOrderAmounts(produit: string, products: { name: string; price: number; id: string }[] = []): {
  prixProduit: number;
  nombreArticles: number;
  fraisLivraison: number;
  totalCommande: number;
} {
  const text = produit.toLowerCase();
  let subtotal = 0;
  let itemCount = 0;

  for (const prod of products) {
    const qty = quantityForProduct(text, prod.name);
    if (qty > 0) {
      subtotal += qty * prod.price;
      itemCount += qty;
    }
  }

  if (subtotal <= 0 && produit.trim()) {
    subtotal = extractPrice(produit);
    itemCount = 1;
  }

  const deliveryFee = itemCount === 1 ? 8 : 0;

  return {
    prixProduit: subtotal,
    nombreArticles: itemCount,
    fraisLivraison: deliveryFee,
    totalCommande: subtotal + deliveryFee,
  };
}

export function applyOrderAmounts(data: OrderData, products: { name: string; price: number; id: string }[]): void {
  const amounts = calculateOrderAmounts(data.produit || "", products);
  Object.assign(data, amounts);
}

function quantityForProduct(text: string, productName: string): number {
  const name = productName.toLowerCase();
  if (text.includes(name)) return 1;
  return 0;
}

function extractPrice(str: string): number {
  const match = str.match(/(\d+)\s*DT/);
  return match ? parseInt(match[1]) : 0;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-]/g, "").replace(/^\+216|^00216/, "");
}

export function normalizeOrderText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function orderToRow(data: OrderData, fillRequiredDefaults = false): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const fields: Array<[keyof OrderData | string, string]> = [
    ["id", "id"],
    ["nom", "nom"],
    ["telephone", "telephone"],
    ["telephone2", "telephone2"],
    ["gouvernorat", "gouvernorat"],
    ["adresse", "adresse"],
    ["produit", "produit"],
    ["prixProduit", "prix_produit"],
    ["fraisLivraison", "frais_livraison"],
    ["totalCommande", "total_commande"],
    ["nombreArticles", "nombre_articles"],
    ["formatPersonnalise", "format_personnalise"],
    ["dateNaissance", "date_naissance"],
    ["signeAstrologique", "signe_astrologique"],
    ["cheminVie", "chemin_vie"],
    ["nombreAme", "nombre_ame"],
    ["nombrePersonnalite", "nombre_personnalite"],
    ["compositionPersonnalisee", "composition_personnalisee"],
    ["briefFabrication", "brief_fabrication"],
    ["notes", "notes"],
    ["statut", "statut"],
    ["date", "date"],
    ["updated_at", "updated_at"],
  ];

  for (const [source, target] of fields) {
    const value = data[source];
    if (value !== undefined) row[target] = value;
  }

  if (fillRequiredDefaults) {
    for (const requiredTextField of [
      "nom",
      "telephone",
      "telephone2",
      "gouvernorat",
      "adresse",
      "produit",
      "format_personnalise",
      "date_naissance",
      "signe_astrologique",
      "chemin_vie",
      "nombre_ame",
      "nombre_personnalite",
      "composition_personnalisee",
      "brief_fabrication",
      "notes",
      "statut",
    ]) {
      if (row[requiredTextField] === undefined || row[requiredTextField] === null) {
        row[requiredTextField] = "";
      }
    }
  }

  if (typeof row.telephone === "string") {
    row.telephone = normalizePhone(row.telephone);
  }

  return row;
}

export async function saveOrderWithoutDuplicate(
  data: OrderData,
  statuses: string[],
  products: { name: string; price: number; id: string }[]
): Promise<{ order: OrderData; created: boolean }> {
  data = normalizeOrderPayload(data);
  const replaceRequested = data.remplace_commande === "true";
  const fusionRequested = !!(data.fusion_avec && data.fusion_avec.trim());

  const newPhone = normalizePhone(data.telephone || "");
  const newProduct = normalizeOrderText(data.produit || "");
  const newName = normalizeOrderText(data.nom || "");
  const now = new Date().toISOString();

  if (newPhone) {
    const twentyFourHoursAgo = new Date(Date.now() - 86400000).toISOString();

    const { data: existingOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("telephone", newPhone)
      .neq("statut", "corbeille")
      .gte("date", twentyFourHoursAgo)
      .order("date", { ascending: false });

    if (existingOrders && existingOrders.length > 0) {
      for (const existing of existingOrders) {
        const sameProduct =
          newProduct !== "" &&
          normalizeOrderText(existing.produit || "") === newProduct;
        const sameName =
          newName !== "" &&
          normalizeOrderText(existing.nom || "") === newName;

        if (replaceRequested || fusionRequested || sameProduct || sameName || !newProduct) {
          const dataToSave = fusionRequested
            ? mergeOrderData(existing, data)
            : { ...data };

          if (!fusionRequested) {
            const backendNote = replaceRequested
              ? "Backend: remplacement demande via remplace_commande. Commande existante mise a jour."
              : "Backend: doublon detecte sur commande recente. Commande existante mise a jour.";
            dataToSave.notes = appendNote(existing.notes || "", appendNote(dataToSave.notes || "", backendNote));
          }

          delete dataToSave.remplace_commande;
          delete dataToSave.fusion_avec;

          const { error } = await supabase
            .from("orders")
            .update(orderToRow({ ...dataToSave, id: existing.id, updated_at: now }) as any)
            .eq("id", existing.id);

          if (error) throw error;

          return {
            order: { ...existing, ...dataToSave, updated_at: now },
            created: false,
          };
        }
      }
    }
  }

  data.id = data.id || generateOrderId();
  data.date = now;
  data.statut = data.statut || statuses[0];

  delete data.remplace_commande;
  delete data.fusion_avec;

  const { error } = await supabase.from("orders").insert(orderToRow(data, true) as any);
  if (error) throw error;

  return { order: data, created: true };
}

function mergeOrderData(existing: OrderData, incoming: OrderData): OrderData {
  const merged = { ...incoming };
  const oldProduct = (existing.produit || "").trim();
  const newProduct = (incoming.produit || "").trim();

  if (oldProduct && newProduct) merged.produit = `${oldProduct} + ${newProduct}`;
  else if (oldProduct && !newProduct) merged.produit = oldProduct;

  let notes = existing.notes || "";
  if (incoming.notes) notes = appendNote(notes, incoming.notes);
  if (incoming.fusion_avec) notes = appendNote(notes, `Fusion demandee avec: ${incoming.fusion_avec}`);
  notes = appendNote(notes, "Backend: fusion effectuee avec une commande recente.");
  merged.notes = notes;

  return merged;
}

export function orderResponse(order: OrderData, created: boolean) {
  return {
    id: order.id,
    nom: order.nom || "",
    produit: order.produit || "",
    statut: order.statut || "attente de confirm tel",
    prixProduit: order.prixProduit || 0,
    fraisLivraison: order.fraisLivraison || 0,
    totalCommande: order.totalCommande || 0,
    nombreArticles: order.nombreArticles || 0,
    notes: order.notes || "",
    created,
  };
}

export function detectOrderFromReply(replyText: string): {
  cleanReply: string;
  orderData: OrderData | null;
} {
  const orderMatch = replyText.match(/<ORDER>(.*?)<\/ORDER>/s);
  if (orderMatch) {
    const cleanReply = replyText.replace(/<ORDER>.*?<\/ORDER>/s, "").trim();
    try {
      const orderData = JSON.parse(orderMatch[1]) as OrderData;
      return { cleanReply, orderData };
    } catch {
      return { cleanReply: replyText, orderData: null };
    }
  }

  // Fallback: bare JSON object
  const jsonMatch = replyText.match(/\{"nom"\s*:.*?\}/s);
  if (jsonMatch) {
    try {
      const orderData = JSON.parse(jsonMatch[0]) as OrderData;
      if (orderData.nom?.trim() && orderData.telephone?.trim()) {
        const cleanReply = replyText.replace(jsonMatch[0], "").trim();
        return { cleanReply, orderData };
      }
    } catch {
      // ignore
    }
  }

  return { cleanReply: replyText, orderData: null };
}

export function detectProductsFromReply(
  replyText: string,
  dbProducts: { id: string; name: string; [key: string]: unknown }[],
  options: { productId?: string | null; productType?: string; userMessage?: string } = {}
): { productData: unknown | null; productList: unknown[] } {
  let productData = null;
  const productList: unknown[] = [];

  const productMatch = replyText.match(/\[RENDER_PRODUCT:(\w+)\]/);
  if (productMatch) {
    const pid = productMatch[1];
    productData = dbProducts.find((p) => p.id === pid) || null;
  }

  const allProducts = replyText.matchAll(/\[RENDER_PRODUCT:(\w+)\]/g);
  const wanted = [...new Set([...allProducts].map((m) => m[1]))];

  if (wanted.length > 0) {
    for (const p of dbProducts) {
      if (wanted.includes(p.id || "")) productList.push(p);
    }
  }

  // Fallback : produit connu par ID (transmis par le frontend)
  if (productList.length === 0 && options.productId) {
    const byId = dbProducts.find((p) => p.id === options.productId || p.slug === options.productId);
    if (byId) { productData = byId; productList.push(byId); }
  }

  return { productData, productList };
}
