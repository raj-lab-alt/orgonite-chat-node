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

function orderToRow(data: OrderData): Record<string, unknown> {
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

  const { error } = await supabase.from("orders").insert(orderToRow(data) as any);
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

  if (productList.length === 0) {
    const fallback = inferProductFromContext(replyText, dbProducts, options);
    if (fallback) {
      productData = fallback;
      productList.push(fallback);
    }
  }

  return { productData, productList };
}

function inferProductFromContext(
  replyText: string,
  dbProducts: { id: string; name: string; [key: string]: unknown }[],
  options: { productId?: string | null; productType?: string; userMessage?: string }
) {
  if (!dbProducts.length) return null;

  if (options.productId) {
    const byId = dbProducts.find((p) => p.id === options.productId || p.slug === options.productId);
    if (byId) return byId;
  }

  const text = normalizeProductMatchText(`${options.userMessage || ""} ${replyText}`);

  const exactName = dbProducts.find((p) => {
    const normalizedName = normalizeProductMatchText(p.name || "");
    return normalizedName.length > 4 && text.includes(normalizedName);
  });
  if (exactName) return exactName;

  const aliasProduct = inferProductByAlias(text, dbProducts);
  if (aliasProduct) return aliasProduct;

  const requestedType = options.productType && options.productType !== "general"
    ? options.productType
    : null;
  if (requestedType) {
    const byType = dbProducts.find((p) => (p.product_type || p.productType) === requestedType);
    if (byType) return byType;
  }

  return null;
}

function normalizeProductMatchText(value: unknown) {
  return normalizeOrderText(String(value || "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/[™®©]/g, " "))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferProductByAlias(
  normalizedText: string,
  dbProducts: { id: string; name: string; [key: string]: unknown }[]
) {
  const aliasesById: Record<string, string[]> = {
    orgonite_islamique: [
      "protection islamique", "orgonite islamique", "baraka", "verset", "coran", "mauvais oeil islamique",
    ],
    orgonite_anti_ondes: [
      "anti ondes", "anti onde", "ondes electromagnetiques", "wifi", "wi fi", "4g", "5g", "sommeil", "emf",
    ],
    coeur_rose_amour: [
      "quartz rose", "coeur rose", "collier coeur quartz rose", "collier quartz rose", "collier amour",
      "amour", "relation", "couple", "blocages affectifs", "energie du coeur",
    ],
    dome_abondance: [
      "abondance", "prosperite", "argent", "opportunite", "fluidite", "dome abondance",
    ],
    cone_voiture: [
      "voiture", "vehicule", "route", "conduite", "cone voiture", "orgonite voiture",
    ],
    orgonite_perso: [
      "personnalisee", "personnalise", "sur mesure", "astrologique", "numerologique", "profil vibratoire",
    ],
    orgonedisc_recharge: [
      "orgondisc", "fleur de vie", "recharge", "recharger", "purifie", "bracelet", "cristaux",
    ],
    coeur_amethyste: [
      "amethyste", "clarte mentale", "serenite", "equilibre emotionnel", "collier violet",
    ],
    coeur_vert_protection: [
      "collier protection", "collier de protection", "coeur vert", "collier vert", "protection",
      "proteger", "bouclier", "mauvais oeil", "fatigue", "stress", "energies lourdes",
    ],
  };

  let best: { product: { id: string; name: string; [key: string]: unknown }; score: number } | null = null;

  for (const product of dbProducts) {
    const productId = String(product.id || "");
    const generatedAliases = [
      productId.replace(/_/g, " "),
      product.slug,
      product.name,
      String(product.name || "").replace(/\b(royale|royal|tm)\b/gi, ""),
    ];
    const configuredAliases = aliasesById[productId] || [];
    const aliases = [...generatedAliases, ...configuredAliases]
      .map(normalizeProductMatchText)
      .filter((alias) => alias.length >= 4);

    for (const alias of aliases) {
      if (!normalizedText.includes(alias)) continue;
      const score = alias.length + (configuredAliases.map(normalizeProductMatchText).includes(alias) ? 40 : 0);
      if (!best || score > best.score) best = { product, score };
    }
  }

  return best?.product || null;
}
