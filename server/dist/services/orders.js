"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderId = generateOrderId;
exports.normalizeOrderPayload = normalizeOrderPayload;
exports.appendNote = appendNote;
exports.calculateOrderAmounts = calculateOrderAmounts;
exports.applyOrderAmounts = applyOrderAmounts;
exports.normalizePhone = normalizePhone;
exports.normalizeOrderText = normalizeOrderText;
exports.saveOrderWithoutDuplicate = saveOrderWithoutDuplicate;
exports.orderResponse = orderResponse;
exports.detectOrderFromReply = detectOrderFromReply;
exports.detectProductsFromReply = detectProductsFromReply;
const supabase_js_1 = require("../lib/supabase.js");
function generateOrderId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${ts}-${rand}`;
}
function normalizeOrderPayload(data) {
    if (data.personnalisation && typeof data.personnalisation === "object") {
        const p = data.personnalisation;
        if (!data.formatPersonnalise && p.forme)
            data.formatPersonnalise = String(p.forme);
        if (!data.dateNaissance && p.date_naissance)
            data.dateNaissance = String(p.date_naissance);
        const comp = [];
        if (p.cristaux)
            comp.push(`Cristaux: ${Array.isArray(p.cristaux) ? p.cristaux.join(", ") : p.cristaux}`);
        if (p.metaux)
            comp.push(`Metaux: ${Array.isArray(p.metaux) ? p.metaux.join(", ") : p.metaux}`);
        if (p.intention_gravure)
            comp.push(`Intention gravure: ${p.intention_gravure}`);
        if (comp.length && !data.compositionPersonnalisee)
            data.compositionPersonnalisee = comp.join(" | ");
        const brief = [];
        for (const key of ["prenom", "nom_naissance", "texte_cv", "texte_ame", "texte_personnalite", "signature_elementaire"]) {
            if (p[key])
                brief.push(`${key}: ${p[key]}`);
        }
        if (brief.length && !data.briefFabrication)
            data.briefFabrication = brief.join(" | ");
        data.notes = appendNote(data.notes || "", `Personnalisation brute: ${JSON.stringify(p, null, 2)}`);
        delete data.personnalisation;
    }
    return data;
}
function appendNote(existing, note) {
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n---\n${note}` : note;
}
function calculateOrderAmounts(produit, products = []) {
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
function applyOrderAmounts(data, products) {
    const amounts = calculateOrderAmounts(data.produit || "", products);
    Object.assign(data, amounts);
}
function quantityForProduct(text, productName) {
    const name = productName.toLowerCase();
    if (text.includes(name))
        return 1;
    return 0;
}
function extractPrice(str) {
    const match = str.match(/(\d+)\s*DT/);
    return match ? parseInt(match[1]) : 0;
}
function normalizePhone(phone) {
    return phone.replace(/[\s\-]/g, "").replace(/^\+216|^00216/, "");
}
function normalizeOrderText(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function orderToRow(data) {
    const row = {};
    const fields = [
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
        if (value !== undefined)
            row[target] = value;
    }
    if (typeof row.telephone === "string") {
        row.telephone = normalizePhone(row.telephone);
    }
    return row;
}
async function saveOrderWithoutDuplicate(data, statuses, products) {
    data = normalizeOrderPayload(data);
    const replaceRequested = data.remplace_commande === "true";
    const fusionRequested = !!(data.fusion_avec && data.fusion_avec.trim());
    const newPhone = normalizePhone(data.telephone || "");
    const newProduct = normalizeOrderText(data.produit || "");
    const newName = normalizeOrderText(data.nom || "");
    const now = new Date().toISOString();
    if (newPhone) {
        const twentyFourHoursAgo = new Date(Date.now() - 86400000).toISOString();
        const { data: existingOrders } = await supabase_js_1.supabase
            .from("orders")
            .select("*")
            .eq("telephone", newPhone)
            .neq("statut", "corbeille")
            .gte("date", twentyFourHoursAgo)
            .order("date", { ascending: false });
        if (existingOrders && existingOrders.length > 0) {
            for (const existing of existingOrders) {
                const sameProduct = newProduct !== "" &&
                    normalizeOrderText(existing.produit || "") === newProduct;
                const sameName = newName !== "" &&
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
                    const { error } = await supabase_js_1.supabase
                        .from("orders")
                        .update(orderToRow({ ...dataToSave, id: existing.id, updated_at: now }))
                        .eq("id", existing.id);
                    if (error)
                        throw error;
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
    const { error } = await supabase_js_1.supabase.from("orders").insert(orderToRow(data));
    if (error)
        throw error;
    return { order: data, created: true };
}
function mergeOrderData(existing, incoming) {
    const merged = { ...incoming };
    const oldProduct = (existing.produit || "").trim();
    const newProduct = (incoming.produit || "").trim();
    if (oldProduct && newProduct)
        merged.produit = `${oldProduct} + ${newProduct}`;
    else if (oldProduct && !newProduct)
        merged.produit = oldProduct;
    let notes = existing.notes || "";
    if (incoming.notes)
        notes = appendNote(notes, incoming.notes);
    if (incoming.fusion_avec)
        notes = appendNote(notes, `Fusion demandee avec: ${incoming.fusion_avec}`);
    notes = appendNote(notes, "Backend: fusion effectuee avec une commande recente.");
    merged.notes = notes;
    return merged;
}
function orderResponse(order, created) {
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
function detectOrderFromReply(replyText) {
    const orderMatch = replyText.match(/<ORDER>(.*?)<\/ORDER>/s);
    if (orderMatch) {
        const cleanReply = replyText.replace(/<ORDER>.*?<\/ORDER>/s, "").trim();
        try {
            const orderData = JSON.parse(orderMatch[1]);
            return { cleanReply, orderData };
        }
        catch {
            return { cleanReply: replyText, orderData: null };
        }
    }
    // Fallback: bare JSON object
    const jsonMatch = replyText.match(/\{"nom"\s*:.*?\}/s);
    if (jsonMatch) {
        try {
            const orderData = JSON.parse(jsonMatch[0]);
            if (orderData.nom?.trim() && orderData.telephone?.trim()) {
                const cleanReply = replyText.replace(jsonMatch[0], "").trim();
                return { cleanReply, orderData };
            }
        }
        catch {
            // ignore
        }
    }
    return { cleanReply: replyText, orderData: null };
}
function detectProductsFromReply(replyText, dbProducts, options = {}) {
    let productData = null;
    const productList = [];
    const productMatch = replyText.match(/\[RENDER_PRODUCT:(\w+)\]/);
    if (productMatch) {
        const pid = productMatch[1];
        productData = dbProducts.find((p) => p.id === pid) || null;
    }
    const allProducts = replyText.matchAll(/\[RENDER_PRODUCT:(\w+)\]/g);
    const wanted = [...new Set([...allProducts].map((m) => m[1]))];
    if (wanted.length > 0) {
        for (const p of dbProducts) {
            if (wanted.includes(p.id || ""))
                productList.push(p);
        }
    }
    // Fallback : produit connu par ID (transmis par le frontend)
    if (productList.length === 0 && options.productId) {
        const byId = dbProducts.find((p) => p.id === options.productId || p.slug === options.productId);
        if (byId) {
            productData = byId;
            productList.push(byId);
        }
    }
    return { productData, productList };
}
//# sourceMappingURL=orders.js.map