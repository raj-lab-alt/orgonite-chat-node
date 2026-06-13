export function formatProduct(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: parseFloat(row.price) || 0,
    currency: row.currency || "DT",
    imageUrl: row.image_url || row.imageUrl || "",
    benefits: row.benefits || "",
    composition: row.composition || "",
    taille: row.taille || "",
    accentColor: row.accent_color || row.accentColor || "#7c3aed",
    productType: row.product_type || row.productType || "",
    welcomeSequence: safeJsonParse(row.welcome_sequence ?? row.welcomeSequence, []),
    stock: parseInt(row.stock) || 0,
    hook: row.hook || "",
    hookTransition: row.hook_transition || row.hookTransition || "",
    upsellPrice: row.upsell_price || row.upsellPrice ? parseFloat(row.upsell_price ?? row.upsellPrice) : null,
    priceOriginal: row.price_original || row.priceOriginal ? parseFloat(row.price_original ?? row.priceOriginal) : null,
    faq: safeJsonParse(row.faq, []),
    reviews: safeJsonParse(row.reviews, []),
    visible: row.visible !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJsonParse(val: unknown, fallback: unknown) {
  if (!val) return fallback;
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
