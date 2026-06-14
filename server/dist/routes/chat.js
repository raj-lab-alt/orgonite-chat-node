"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const reply_sanitize_js_1 = require("../lib/reply-sanitize.js");
const logger_js_1 = require("../lib/logger.js");
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
    catch {
        logger_js_1.logger.warn("Failed to load products");
    }
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
function toClientReply(reply, productList) {
    let cleanReply = reply
        .replace(/<ORDER>[\s\S]*?<\/ORDER>/gi, "")
        .replace(/<ORDER>[\s\S]*$/gi, "")
        .replace(/\{\s*"nom"\s*:[\s\S]*?\}/g, "")
        .replace(/\[RENDER_PRODUCT:\s*[a-zA-Z0-9_]+\]/g, "")
        .trim();
    if (productList.length === 0) {
        cleanReply = cleanReply
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/\[[^\]]+\]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }
    return cleanReply;
}
function errorStatus(err) {
    const status = Number(err?.statusCode || err?.status);
    return status >= 400 && status < 600 ? status : 500;
}
function productNameInMessage(message, products) {
    const lower = message.toLowerCase();
    const mentioned = new Set();
    for (const p of products) {
        if (p.name && lower.includes(p.name.toLowerCase())) {
            mentioned.add(p.id);
        }
    }
    return mentioned;
}
function missingOrderFields(orderData) {
    const required = [
        ["nom", "nom"],
        ["telephone", "telephone"],
        ["gouvernorat", "gouvernorat"],
        ["adresse", "adresse"],
        ["produit", "produit"],
    ];
    return required
        .filter(([key]) => !String(orderData?.[key] || "").trim())
        .map(([, label]) => label);
}
function conversationSessionKey(req) {
    const headerKey = req.headers["x-session-key"];
    const rawKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    return String(rawKey || req.ip || "unknown").slice(0, 64);
}
async function recordConversationStats(req, mode, result) {
    try {
        const sessionKey = conversationSessionKey(req);
        const normalizedMode = (mode || "A").slice(0, 1).toUpperCase();
        const stage = result.order ? "commande" : result.products?.length ? "produit" : "conversation";
        const { data } = await supabase_js_1.supabase
            .from("conversation_stats")
            .select("messages_count")
            .eq("session_key", sessionKey)
            .maybeSingle();
        if (data) {
            await supabase_js_1.supabase
                .from("conversation_stats")
                .update({
                mode: normalizedMode,
                messages_count: (data.messages_count || 0) + 2,
                stage,
                updated_at: new Date().toISOString(),
            })
                .eq("session_key", sessionKey);
            return;
        }
        await supabase_js_1.supabase.from("conversation_stats").insert({
            session_key: sessionKey,
            mode: normalizedMode,
            messages_count: 2,
            stage,
        });
    }
    catch (err) {
        logger_js_1.logger.warn("Conversation stats not recorded", { error: (err?.message || String(err)) });
    }
}
async function generateChatResult(message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed = false, renderedProductIds = []) {
    let apiKeys, models, products, statuses, dbSystemPrompt, catalogItemTemplate;
    let catalog;
    let systemPrompt;
    try {
        const config = await getConfig();
        apiKeys = config.apiKeys;
        models = config.models;
        products = config.products;
        statuses = config.statuses;
        dbSystemPrompt = config.systemPrompt;
        catalogItemTemplate = config.catalogItemTemplate;
        catalog = catalogProducts(products);
        systemPrompt = (0, prompt_js_1.getSystemPrompt)(catalog, dbSystemPrompt, catalogItemTemplate, productType);
    }
    catch {
        return { reply: "Desole, une erreur est survenue. Veuillez reessayer.", order: null, product: null, products: [] };
    }
    let fullReply = "";
    try {
        const stream = (0, gemini_js_1.chatGeminiRequestStream)(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models);
        for await (const chunk of stream) {
            fullReply += chunk;
        }
    }
    catch (err) {
        logger_js_1.logger.error("Gemini chat error", { error: err.message });
        fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
    }
    const visibleReply = (0, reply_sanitize_js_1.sanitizeAssistantReply)(fullReply);
    const { cleanReply, orderData } = (0, orders_js_1.detectOrderFromReply)(visibleReply);
    let savedOrder = null;
    let orderValidationReply = "";
    if (orderData) {
        const normalized = (0, orders_js_1.normalizeOrderPayload)(orderData);
        normalized.id = (0, orders_js_1.generateOrderId)();
        normalized.date = new Date().toISOString();
        normalized.statut = statuses[0];
        const missing = missingOrderFields(normalized);
        if (missing.length > 0) {
            logger_js_1.logger.warn(`Incomplete order ignored. Missing: ${missing.join(", ")}`);
            orderValidationReply =
                "Il me manque encore quelques informations pour enregistrer la commande : " +
                    missing.join(", ") +
                    ". Peux-tu me les envoyer ?";
        }
        else {
            (0, orders_js_1.applyOrderAmounts)(normalized, products.map((p) => ({ name: p.name, price: p.price, id: p.id })));
            const saved = await (0, orders_js_1.saveOrderWithoutDuplicate)(normalized, statuses, products.map((p) => ({ name: p.name, price: p.price, id: p.id })));
            savedOrder = (0, orders_js_1.orderResponse)(saved.order, saved.created);
        }
    }
    const reply = stripPrematureUpsell(orderValidationReply || cleanReply || visibleReply, message, orderConfirmed, Boolean(savedOrder));
    const { productData, productList } = (0, orders_js_1.detectProductsFromReply)(reply, products, {
        productId,
        productType,
        userMessage: recentConversationText(history, message),
    });
    // Dedup: don't re-render cards already shown in this conversation,
    // unless the user explicitly mentions the product by name
    if (renderedProductIds.length > 0 && productList.length > 0) {
        const mentionedIds = productNameInMessage(message, products);
        const filtered = productList.filter((p) => !renderedProductIds.includes(p.id) || mentionedIds.has(p.id));
        if (filtered.length !== productList.length) {
            logger_js_1.logger.info(`filtered ${productList.length - filtered.length} already-rendered products`);
            productList.splice(0, productList.length, ...filtered);
        }
    }
    const cleanFinalReply = toClientReply(reply, productList);
    return { reply: cleanFinalReply, order: savedOrder, product: productData, products: productList };
}
async function handleChatSSE(req, res, message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed = false, renderedProductIds = []) {
    logger_js_1.logger.info("SSE: start", { msgLen: message.length });
    try {
        if (!res.headersSent) {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
                "X-Passenger-Buffering": "no",
                "X-LiteSpeed-Buffering": "no",
            });
        }
    }
    catch {
        logger_js_1.logger.error("SSE: writeHead failed");
        if (!res.writableEnded) {
            try {
                res.end();
            }
            catch { }
        }
        return;
    }
    logger_js_1.logger.info("SSE: headers sent");
    const reqAborted = () => req.destroyed;
    let apiKeys, models, products, statuses, dbSystemPrompt, catalogItemTemplate;
    let catalog;
    let systemPrompt;
    try {
        const config = await getConfig();
        apiKeys = config.apiKeys;
        models = config.models;
        products = config.products;
        statuses = config.statuses;
        dbSystemPrompt = config.systemPrompt;
        catalogItemTemplate = config.catalogItemTemplate;
        catalog = catalogProducts(products);
        systemPrompt = (0, prompt_js_1.getSystemPrompt)(catalog, dbSystemPrompt, catalogItemTemplate, productType);
    }
    catch (err) {
        logger_js_1.logger.error("SSE: config error", { error: err.message });
        if (!res.writableEnded) {
            try {
                res.write(`data: ${JSON.stringify({ error: "Erreur de configuration" })}\n\n`);
            }
            catch { }
            res.end();
        }
        return;
    }
    logger_js_1.logger.info("SSE: config loaded", { keyCount: apiKeys?.length, modelCount: models?.length });
    // Phase 1: stream Gemini tokens
    let fullReply = "";
    try {
        logger_js_1.logger.info("SSE: starting Gemini stream");
        const stream = (0, gemini_js_1.chatGeminiRequestStream)(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models);
        for await (const chunk of stream) {
            if (reqAborted()) {
                logger_js_1.logger.info("SSE: client aborted during stream");
                try {
                    res.end();
                }
                catch { }
                return;
            }
            fullReply += chunk;
            try {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }
            catch {
                logger_js_1.logger.warn("SSE: write chunk failed");
            }
        }
        logger_js_1.logger.info("SSE: Gemini stream done", { replyLen: fullReply.length });
    }
    catch (err) {
        logger_js_1.logger.error("SSE: Gemini error", { error: err.message });
        if (!fullReply) {
            fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
            try {
                res.write(`data: ${JSON.stringify({ text: fullReply })}\n\n`);
            }
            catch { }
        }
    }
    // Phase 2: process order + products
    let visibleReply = fullReply;
    let cleanReply = fullReply;
    let orderData = null;
    let savedOrder = null;
    let orderValidationReply = "";
    let productData = null;
    let productList = [];
    let replyForClient = toClientReply((0, reply_sanitize_js_1.sanitizeAssistantReply)(fullReply), []);
    try {
        visibleReply = (0, reply_sanitize_js_1.sanitizeAssistantReply)(fullReply);
        const orderResult = (0, orders_js_1.detectOrderFromReply)(visibleReply);
        cleanReply = orderResult.cleanReply;
        orderData = orderResult.orderData;
        if (orderData) {
            const normalized = (0, orders_js_1.normalizeOrderPayload)(orderData);
            normalized.id = (0, orders_js_1.generateOrderId)();
            normalized.date = new Date().toISOString();
            normalized.statut = statuses[0];
            const missing = missingOrderFields(normalized);
            if (missing.length > 0) {
                logger_js_1.logger.warn(`Incomplete order ignored. Missing: ${missing.join(", ")}`);
                orderValidationReply =
                    "Il me manque encore quelques informations pour enregistrer la commande : " +
                        missing.join(", ") +
                        ". Peux-tu me les envoyer ?";
            }
            else {
                const productPriceRefs = products.map((p) => ({ name: p.name, price: p.price, id: p.id }));
                (0, orders_js_1.applyOrderAmounts)(normalized, productPriceRefs);
                const saved = await (0, orders_js_1.saveOrderWithoutDuplicate)(normalized, statuses, productPriceRefs);
                savedOrder = (0, orders_js_1.orderResponse)(saved.order, saved.created);
            }
        }
        const reply = stripPrematureUpsell(orderValidationReply || cleanReply || visibleReply, message, orderConfirmed, Boolean(savedOrder));
        const detected = (0, orders_js_1.detectProductsFromReply)(reply, products, {
            productId,
            productType,
            userMessage: recentConversationText(history, message),
        });
        productData = detected.productData;
        productList = detected.productList;
        if (renderedProductIds.length > 0 && productList.length > 0) {
            const mentionedIds = productNameInMessage(message, products);
            const filtered = productList.filter((p) => !renderedProductIds.includes(p.id) || mentionedIds.has(p.id));
            if (filtered.length !== productList.length) {
                logger_js_1.logger.info(`filtered ${productList.length - filtered.length} already-rendered products`);
                productList.splice(0, productList.length, ...filtered);
            }
        }
        replyForClient = toClientReply(reply, productList);
    }
    catch (err) {
        logger_js_1.logger.error("SSE: phase2 error", { error: err.message });
    }
    const result = { reply: replyForClient || fullReply, order: savedOrder, product: productData, products: productList };
    try {
        await recordConversationStats(req, conversationMode, result);
    }
    catch { /* stats are best-effort */ }
    try {
        logger_js_1.logger.info("SSE: sending done event");
        res.write(`data: ${JSON.stringify({ done: true, reply: result.reply, order: result.order, product: result.product, products: result.products })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        logger_js_1.logger.info("SSE: done");
    }
    catch {
        logger_js_1.logger.warn("SSE: final write failed (client disconnected)");
        try {
            res.end();
        }
        catch { }
    }
}
// GET /api/chat/diag — diagnostic endpoint
exports.chatRouter.get("/diag", async (_req, res) => {
    try {
        const diag = {};
        diag.step1 = "started";
        const { getAppConfig } = await Promise.resolve().then(() => __importStar(require("../lib/app-config.js")));
        diag.step2 = "imported config";
        const config = await getAppConfig();
        diag.step3 = "got config";
        diag.hasGeminiKeys = config.geminiApiKeys.length > 0;
        diag.geminiKeyCount = config.geminiApiKeys.length;
        diag.geminiModels = config.geminiModels;
        diag.configSource = config.source;
        // Add directory listing to diagnose the 403 issue
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        diag.cwd = process.cwd();
        diag.dirname = __dirname;
        diag.envKeys = Object.keys(process.env);
        diag.port = process.env.PORT;
        diag.nodeVersion = process.version;
        // Check files in current dir
        try {
            diag.filesInCwd = fs.readdirSync(process.cwd());
        }
        catch (e) {
            diag.filesInCwdError = e.message;
        }
        // Check files in parent dir
        try {
            diag.filesInParent = fs.readdirSync(path.join(process.cwd(), ".."));
        }
        catch (e) {
            diag.filesInParentError = e.message;
        }
        // Check if .htaccess exists anywhere
        const htaccessPaths = [
            path.join(process.cwd(), ".htaccess"),
            path.join(process.cwd(), "..", ".htaccess"),
            path.join(process.cwd(), "../..", ".htaccess")
        ];
        diag.htaccessChecks = {};
        for (const p of htaccessPaths) {
            diag.htaccessChecks[p] = {
                exists: fs.existsSync(p),
                content: fs.existsSync(p) ? fs.readFileSync(p, "utf8").substring(0, 1000) : null
            };
        }
        diag.step4 = "ok";
        res.json(diag);
    }
    catch (err) {
        res.json({ error: err.message, stack: err.stack });
    }
});
// GET /api/chat/ping — sync test
exports.chatRouter.get("/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});
// POST /api/chat/echo — setTimeout(0) test
exports.chatRouter.post("/echo", (req, res) => {
    setTimeout(() => {
        try {
            res.json({ ok: true, body: req.body, ts: Date.now() });
        }
        catch (e) {
            if (!res.headersSent)
                res.status(500).json({ error: e.message });
        }
    }, 0);
});
// GET /api/chat/test-sse — full SSE diagnostic
exports.chatRouter.get("/test-sse", (_req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Passenger-Buffering": "no",
        "X-LiteSpeed-Buffering": "no",
    });
    const send = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        catch { }
    };
    send({ step: 1, msg: "SSE headers sent" });
    send({ step: 2, msg: "Phase 2 — checking write capability" });
    send({ step: 3, msg: "Phase 3 — done event" });
    send({ done: true, reply: "Test SSE OK", testTs: Date.now() });
    send({ done: true, msg: "[DONE]" });
    try {
        res.end();
    }
    catch { }
});
// POST /api/chat — text + optional image
exports.chatRouter.post("/", (req, res) => {
    setTimeout(async () => {
        try {
            await (0, rate_limit_js_1.checkRateLimit)(req.ip);
            const body = zod_1.z.object({
                message: zod_1.z.string().max(2000).default(""),
                imageBase64: zod_1.z.string().nullable().optional(),
                imageMimeType: zod_1.z.string().nullable().optional(),
                productId: zod_1.z.string().nullable().optional(),
                productType: zod_1.z.string().default("general"),
                conversationMode: zod_1.z.string().default(""),
                history: zod_1.z.array(zod_1.z.any()).default([]),
                renderedProductIds: zod_1.z.array(zod_1.z.string()).default([]),
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
                await handleChatSSE(req, res, message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed, body.renderedProductIds);
                return;
            }
            const result = await generateChatResult(message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed, body.renderedProductIds);
            await recordConversationStats(req, body.conversationMode, result);
            if (!res.writableEnded) {
                res.json(result);
            }
        }
        catch (err) {
            if (err instanceof zod_1.z.ZodError) {
                if (!res.writableEnded) {
                    res.status(400).json({
                        error: err.errors.map((issue) => issue.message).join(", "),
                    });
                }
                return;
            }
            const errMsg = err && typeof err === "object" ? (err.message || String(err)) : String(err);
            logger_js_1.logger.error("Chat error", { error: errMsg });
            if (!res.writableEnded) {
                const status = errorStatus(err);
                res.status(status).json({ error: status === 429 ? errMsg : "Erreur interne du serveur" });
            }
        }
    }, 0);
});
// POST /api/chat/voice — audio message
exports.chatRouter.post("/voice", upload.single("audio"), (req, res) => {
    setTimeout(async () => {
        try {
            await (0, rate_limit_js_1.checkRateLimit)(req.ip);
            if (!req.file) {
                res.status(400).json({ error: "Fichier audio manquant" });
                return;
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
                catch {
                    logger_js_1.logger.warn("Invalid history JSON");
                }
            }
            let renderedProductIds = [];
            if (req.body.renderedProductIds) {
                try {
                    renderedProductIds = JSON.parse(req.body.renderedProductIds);
                }
                catch {
                    logger_js_1.logger.warn("Invalid renderedProductIds JSON");
                }
            }
            const extraFields = { imageBase64: null, imageMimeType: null, audioBase64, audioMimeType };
            const wantsStream = req.query.stream === "1" || req.headers.accept?.includes("text/event-stream");
            if (wantsStream) {
                await handleChatSSE(req, res, message, extraFields, history, productId, conversationMode, true, productType, false, renderedProductIds);
                return;
            }
            const result = await generateChatResult(message, extraFields, history, productId, conversationMode, true, productType, false, renderedProductIds);
            await recordConversationStats(req, conversationMode, result);
            res.json(result);
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger_js_1.logger.error("Voice chat error", { error: errMsg });
            if (!res.headersSent) {
                const status = errorStatus(err);
                res.status(status).json({ error: status === 429 ? errMsg : "Erreur interne du serveur" });
            }
        }
    }, 0);
});
//# sourceMappingURL=chat.js.map