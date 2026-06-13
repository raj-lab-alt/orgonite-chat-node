"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("../lib/supabase.js");
const prompt_js_1 = require("../lib/prompt.js");
const gemini_js_1 = require("../services/gemini.js");
const orders_js_1 = require("../services/orders.js");
const rate_limit_js_1 = require("../services/rate-limit.js");
const app_config_js_1 = require("../lib/app-config.js");
const product_format_js_1 = require("../lib/product-format.js");
exports.chatRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
async function getConfig() {
    const appConfig = await (0, app_config_js_1.getAppConfig)();
    let products = [];
    try {
        const { data } = await supabase_js_1.supabase.from("products").select("*").eq("visible", true);
        if (data)
            products = data;
    }
    catch { }
    return {
        apiKeys: appConfig.geminiApiKeys,
        models: appConfig.geminiModels,
        products: products.map(product_format_js_1.formatProduct),
        statuses: appConfig.statuses,
        systemPrompt: appConfig.systemPrompt,
        catalogItemTemplate: appConfig.catalogItemTemplate,
    };
}
function catalogProducts(products) {
    return products.map((p) => ({
        id: p.id, name: p.name, price: p.price, currency: p.currency,
        benefits: p.benefits, composition: p.composition || "", taille: p.taille || "",
    }));
}
function recentConversationText(history, message) {
    const historyText = history
        .slice(-8)
        .map((item) => item?.text || item?.content || "")
        .filter(Boolean)
        .join("\n");
    return `${historyText}\n${message}`.trim();
}
function isAffirmationOnly(message) {
    const normalized = message
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    return /^(oui|ok|d accord|daccord|yes|yep|interesse|interessee|ca me parle|ça me parle|parle moi|montre moi)$/.test(normalized);
}
function stripPrematureUpsell(reply, message, orderConfirmed, hasOrder) {
    if (orderConfirmed || hasOrder || !isAffirmationOnly(message))
        return reply;
    if (!/livraison offerte|2 outils|deux outils|economiser|économiser|cadeau protecteur|profiter/i.test(reply)) {
        return reply;
    }
    const [beforeSeparator] = reply.split(/\n\s*---+\s*\n/);
    const cleaned = beforeSeparator
        .replace(/(?:^|\n).*livraison offerte[\s\S]*$/i, "")
        .replace(/(?:^|\n).*2 outils[\s\S]*$/i, "")
        .trim();
    return cleaned || reply;
}
async function generateChatResult(message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed = false) {
    const { apiKeys, models, products, statuses, systemPrompt: dbSystemPrompt, catalogItemTemplate } = await getConfig();
    const catalog = catalogProducts(products);
    const systemPrompt = (0, prompt_js_1.getSystemPrompt)(catalog, dbSystemPrompt, catalogItemTemplate, productType);
    let fullReply = "";
    try {
        const stream = (0, gemini_js_1.chatGeminiRequestStream)(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models);
        for await (const chunk of stream) {
            fullReply += chunk;
        }
    }
    catch (err) {
        console.error("Gemini chat error:", err.message);
        fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
    }
    const { cleanReply, orderData } = (0, orders_js_1.detectOrderFromReply)(fullReply);
    let savedOrder = null;
    if (orderData) {
        const normalized = (0, orders_js_1.normalizeOrderPayload)(orderData);
        normalized.id = (0, orders_js_1.generateOrderId)();
        normalized.date = new Date().toISOString();
        normalized.statut = statuses[0];
        if (normalized.produit?.trim()) {
            (0, orders_js_1.applyOrderAmounts)(normalized, products.map((p) => ({ name: p.name, price: p.price, id: p.id })));
            const saved = await (0, orders_js_1.saveOrderWithoutDuplicate)(normalized, statuses, products.map((p) => ({ name: p.name, price: p.price, id: p.id })));
            savedOrder = (0, orders_js_1.orderResponse)(saved.order, saved.created);
        }
    }
    const reply = stripPrematureUpsell(cleanReply || fullReply, message, orderConfirmed, Boolean(savedOrder));
    const { productData, productList } = (0, orders_js_1.detectProductsFromReply)(reply, products, {
        productId,
        productType,
        userMessage: recentConversationText(history, message),
    });
    return { reply, order: savedOrder, product: productData, products: productList };
}
async function handleChatSSE(res, message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed = false) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    const result = await generateChatResult(message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed);
    res.write(`data: ${JSON.stringify({ text: result.reply })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
}
// POST /api/chat — text + optional image
exports.chatRouter.post("/", async (req, res) => {
    try {
        await (0, rate_limit_js_1.checkRateLimit)();
        const body = zod_1.z.object({
            message: zod_1.z.string().max(2000).default(""),
            imageBase64: zod_1.z.string().nullable().optional(),
            imageMimeType: zod_1.z.string().nullable().optional(),
            productId: zod_1.z.string().nullable().optional(),
            productType: zod_1.z.string().default("general"),
            conversationMode: zod_1.z.string().default(""),
            history: zod_1.z.array(zod_1.z.any()).default([]),
            orderConfirmed: zod_1.z.boolean().default(false),
            stream: zod_1.z.boolean().optional(),
        }).refine((value) => value.message.trim().length > 0 || Boolean(value.imageBase64), {
            message: "message ou image requis",
            path: ["message"],
        }).parse(req.body);
        let message = body.message;
        if (body.orderConfirmed) {
            message = `[INSTRUCTION]Le prospect a deja confirme sa commande via la modale. NE PAS demander de confirmation ni re-presenter l'outil. Suivre le Closing normal etape par etape (nom → gouvernorat → adresse → telephone → disponibilite). Une fois la commande creee avec <ORDER>, AVANT d'envoyer le message de confirmation finale, proposer OBLIGATOIREMENT l'upsell livraison offerte des 2 outils. Ne pas sauter l'upsell.[/INSTRUCTION] ${message}`;
        }
        const extraFields = {
            imageBase64: body.imageBase64 || null,
            imageMimeType: body.imageMimeType || null,
            audioBase64: null,
            audioMimeType: null,
        };
        const wantsStream = body.stream === true || req.query.stream === "1" || req.headers.accept?.includes("text/event-stream");
        if (wantsStream) {
            await handleChatSSE(res, message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed);
            return;
        }
        const result = await generateChatResult(message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed);
        res.json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: err.errors.map((issue) => issue.message).join(", "),
            });
        }
        console.error("Chat error:", err);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});
// POST /api/chat/voice — audio message
exports.chatRouter.post("/voice", upload.single("audio"), async (req, res) => {
    try {
        await (0, rate_limit_js_1.checkRateLimit)();
        if (!req.file) {
            return res.status(400).json({ error: "Fichier audio manquant" });
        }
        const audioBase64 = req.file.buffer.toString("base64");
        const audioMimeType = req.file.mimetype || "audio/webm";
        const message = (req.body.message || "").slice(0, 2000);
        const productId = req.body.productId || null;
        const productType = req.body.productType || "general";
        const conversationMode = req.body.conversationMode || "";
        let history = [];
        if (req.body.history) {
            try {
                history = JSON.parse(req.body.history);
            }
            catch { }
        }
        const extraFields = { imageBase64: null, imageMimeType: null, audioBase64, audioMimeType };
        const wantsStream = req.query.stream === "1" || req.headers.accept?.includes("text/event-stream");
        if (wantsStream) {
            await handleChatSSE(res, message, extraFields, history, productId, conversationMode, true, productType, false);
            return;
        }
        const result = await generateChatResult(message, extraFields, history, productId, conversationMode, true, productType, false);
        res.json(result);
    }
    catch (err) {
        console.error("Voice chat error:", err);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});
//# sourceMappingURL=chat.js.map