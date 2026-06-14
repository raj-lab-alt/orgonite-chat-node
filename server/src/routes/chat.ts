import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import { getSystemPrompt } from "../lib/prompt.js";
import { chatGeminiRequestStream } from "../services/gemini.js";
import {
  detectOrderFromReply,
  detectProductsFromReply,
  saveOrderWithoutDuplicate,
  applyOrderAmounts,
  orderResponse,
  generateOrderId,
  normalizeOrderPayload,
} from "../services/orders.js";
import { checkRateLimit } from "../services/rate-limit.js";
import { getAppConfig } from "../lib/app-config.js";
import { formatProduct } from "../lib/product-format.js";
import { sanitizeAssistantReply } from "../lib/reply-sanitize.js";
import { logger } from "../lib/logger.js";
import { requireAdmin } from "../middleware/auth.js";

export const chatRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getConfig() {
  const appConfig = await getAppConfig();
  let products: any[] = [];
  try { const { data } = await supabase.from("products").select("*").eq("visible", true); if (data) products = data; } catch { logger.warn("Failed to load products"); }
  return {
    apiKeys: appConfig.geminiApiKeys,
    models: appConfig.geminiModels,
    products: products.map(formatProduct),
    statuses: appConfig.statuses,
    systemPrompt: appConfig.systemPrompt,
    catalogItemTemplate: appConfig.catalogItemTemplate,
  };
}

function catalogProducts(products: any[]) {
  return products.map((p: any) => ({
    id: p.id, name: p.name, price: p.price, currency: p.currency,
    benefits: p.benefits, composition: p.composition || "", taille: p.taille || "",
  }));
}

interface ChatResult {
  reply: string;
  order: any;
  product: any;
  products: any[];
}

function recentConversationText(history: any[], message: string) {
  const historyText = history
    .slice(-8)
    .map((item) => item?.text || item?.content || "")
    .filter(Boolean)
    .join("\n");
  return `${historyText}\n${message}`.trim();
}

function isAffirmationOnly(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /^(oui|ok|d accord|daccord|yes|yep|interesse|interessee|ca me parle|ça me parle|parle moi|montre moi)$/.test(normalized);
}

function stripPrematureUpsell(reply: string, message: string, orderConfirmed: boolean, hasOrder: boolean) {
  if (orderConfirmed || hasOrder || !isAffirmationOnly(message)) return reply;
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

function toClientReply(reply: string, productList: any[]) {
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

function errorStatus(err: any) {
  const status = Number(err?.statusCode || err?.status);
  return status >= 400 && status < 600 ? status : 500;
}

function productNameInMessage(message: string, products: any[]): Set<string> {
  const lower = message.toLowerCase();
  const mentioned = new Set<string>();
  for (const p of products) {
    if (p.name && lower.includes(p.name.toLowerCase())) {
      mentioned.add(p.id);
    }
  }
  return mentioned;
}

function missingOrderFields(orderData: any) {
  const required: Array<[string, string]> = [
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

function conversationSessionKey(req: Request) {
  const headerKey = req.headers["x-session-key"];
  const rawKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
  return String(rawKey || req.ip || "unknown").slice(0, 64);
}

async function recordConversationStats(req: Request, mode: string, result: ChatResult) {
  try {
    const sessionKey = conversationSessionKey(req);
    const normalizedMode = (mode || "A").slice(0, 1).toUpperCase();
    const stage = result.order ? "commande" : result.products?.length ? "produit" : "conversation";

    const { data } = await supabase
      .from("conversation_stats")
      .select("messages_count")
      .eq("session_key", sessionKey)
      .maybeSingle();

    if (data) {
      await supabase
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

    await supabase.from("conversation_stats").insert({
      session_key: sessionKey,
      mode: normalizedMode,
      messages_count: 2,
      stage,
    });
  } catch (err: any) {
    logger.warn("Conversation stats not recorded", { error: (err?.message || String(err)) });
  }
}

async function generateChatResult(
  message: string,
  extraFields: any,
  history: any[],
  productId: string | null,
  conversationMode: string,
  isVoice: boolean,
  productType: string,
  orderConfirmed = false,
  renderedProductIds: string[] = [],
): Promise<ChatResult> {
  let apiKeys: string[], models: string[], products: any[], statuses: string[], dbSystemPrompt: string | undefined, catalogItemTemplate: string | undefined;
  let catalog: any[];
  let systemPrompt: string;

  try {
    const config = await getConfig();
    apiKeys = config.apiKeys;
    models = config.models;
    products = config.products;
    statuses = config.statuses;
    dbSystemPrompt = config.systemPrompt;
    catalogItemTemplate = config.catalogItemTemplate;
    catalog = catalogProducts(products);
    systemPrompt = getSystemPrompt(catalog, dbSystemPrompt, catalogItemTemplate, productType);
  } catch {
    return { reply: "Desole, une erreur est survenue. Veuillez reessayer.", order: null, product: null, products: [] };
  }

  let fullReply = "";

  try {
    const stream = chatGeminiRequestStream(
      message, extraFields, history, productId, conversationMode,
      isVoice, productType, systemPrompt, apiKeys, models
    );

    for await (const chunk of stream) {
      fullReply += chunk;
    }
  } catch (err: any) {
    logger.error("Gemini chat error", { error: err.message });
    fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
  }

  const visibleReply = sanitizeAssistantReply(fullReply);
  const { cleanReply, orderData } = detectOrderFromReply(visibleReply);
  let savedOrder = null;
  let orderValidationReply = "";

  if (orderData) {
    const normalized = normalizeOrderPayload(orderData);
    normalized.id = generateOrderId();
    normalized.date = new Date().toISOString();
    normalized.statut = statuses[0];

    const missing = missingOrderFields(normalized);
    if (missing.length > 0) {
      logger.warn(`Incomplete order ignored. Missing: ${missing.join(", ")}`);
      orderValidationReply =
        "Il me manque encore quelques informations pour enregistrer la commande : " +
        missing.join(", ") +
        ". Peux-tu me les envoyer ?";
    } else {
      applyOrderAmounts(normalized, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      const saved = await saveOrderWithoutDuplicate(normalized, statuses, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      savedOrder = orderResponse(saved.order, saved.created);
    }
  }

  const reply = stripPrematureUpsell(orderValidationReply || cleanReply || visibleReply, message, orderConfirmed, Boolean(savedOrder));
  const { productData, productList } = detectProductsFromReply(reply, products, {
    productId,
    productType,
    userMessage: recentConversationText(history, message),
  });

  // Dedup: don't re-render cards already shown in this conversation,
  // unless the user explicitly mentions the product by name
  if (renderedProductIds.length > 0 && productList.length > 0) {
    const mentionedIds = productNameInMessage(message, products);
    const filtered = productList.filter(
      (p: any) => !renderedProductIds.includes(p.id) || mentionedIds.has(p.id)
    );
    if (filtered.length !== productList.length) {
      logger.info(`filtered ${productList.length - filtered.length} already-rendered products`);
      productList.splice(0, productList.length, ...filtered);
    }
  }

  const cleanFinalReply = toClientReply(reply, productList);

  return { reply: cleanFinalReply, order: savedOrder, product: productData, products: productList };
}

async function handleChatSSE(
  req: Request,
  res: Response,
  message: string,
  extraFields: any,
  history: any[],
  productId: string | null,
  conversationMode: string,
  isVoice: boolean,
  productType: string,
  orderConfirmed = false,
  renderedProductIds: string[] = [],
) {
  try {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
  } catch {
    return;
  }

  const reqAborted = () => req.destroyed;

  let apiKeys: string[], models: string[], products: any[], statuses: string[], dbSystemPrompt: string | undefined, catalogItemTemplate: string | undefined;
  let catalog: any[];
  let systemPrompt: string;

  try {
    const config = await getConfig();
    apiKeys = config.apiKeys;
    models = config.models;
    products = config.products;
    statuses = config.statuses;
    dbSystemPrompt = config.systemPrompt;
    catalogItemTemplate = config.catalogItemTemplate;
    catalog = catalogProducts(products);
    systemPrompt = getSystemPrompt(catalog, dbSystemPrompt, catalogItemTemplate, productType);
  } catch (err: any) {
    logger.error("handleChatSSE config error", { error: err.message });
    if (!res.writableEnded) res.end();
    return;
  }

  // Phase 1: stream Gemini tokens immediately
  let fullReply = "";
  try {
    const stream = chatGeminiRequestStream(
      message, extraFields, history, productId, conversationMode,
      isVoice, productType, systemPrompt, apiKeys, models
    );

    for await (const chunk of stream) {
      if (reqAborted()) { res.end(); return; }
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
  } catch (err: any) {
    logger.error("Gemini chat error", { error: err.message });
    if (!fullReply) {
      fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
      res.write(`data: ${JSON.stringify({ text: fullReply })}\n\n`);
    }
  }

  // Phase 2: process order + products
  let visibleReply = fullReply;
  let cleanReply = fullReply;
  let orderData = null;
  let savedOrder = null;
  let orderValidationReply = "";
  let productData = null;
  let productList: any[] = [];
  let replyForClient = toClientReply(sanitizeAssistantReply(fullReply), []);

  try {
    visibleReply = sanitizeAssistantReply(fullReply);
    const orderResult = detectOrderFromReply(visibleReply);
    cleanReply = orderResult.cleanReply;
    orderData = orderResult.orderData;

    if (orderData) {
      const normalized = normalizeOrderPayload(orderData);
      normalized.id = generateOrderId();
      normalized.date = new Date().toISOString();
      normalized.statut = statuses[0];

      const missing = missingOrderFields(normalized);
      if (missing.length > 0) {
        logger.warn(`Incomplete order ignored. Missing: ${missing.join(", ")}`);
        orderValidationReply =
          "Il me manque encore quelques informations pour enregistrer la commande : " +
          missing.join(", ") +
          ". Peux-tu me les envoyer ?";
      } else {
        const productPriceRefs = products.map((p: any) => ({ name: p.name, price: p.price, id: p.id }));
        applyOrderAmounts(normalized, productPriceRefs);
        const saved = await saveOrderWithoutDuplicate(normalized, statuses, productPriceRefs);
        savedOrder = orderResponse(saved.order, saved.created);
      }
    }

    const reply = stripPrematureUpsell(orderValidationReply || cleanReply || visibleReply, message, orderConfirmed, Boolean(savedOrder));
    const detected = detectProductsFromReply(reply, products, {
      productId,
      productType,
      userMessage: recentConversationText(history, message),
    });
    productData = detected.productData;
    productList = detected.productList;

    if (renderedProductIds.length > 0 && productList.length > 0) {
      const mentionedIds = productNameInMessage(message, products);
      const filtered = productList.filter(
        (p: any) => !renderedProductIds.includes(p.id) || mentionedIds.has(p.id)
      );
      if (filtered.length !== productList.length) {
        logger.info(`filtered ${productList.length - filtered.length} already-rendered products`);
        productList.splice(0, productList.length, ...filtered);
      }
    }

    replyForClient = toClientReply(reply, productList);
  } catch (err: any) {
    logger.error("handleChatSSE phase2 error", { error: err.message });
  }

  const result: ChatResult = { reply: replyForClient || fullReply, order: savedOrder, product: productData, products: productList };
  try {
    await recordConversationStats(req, conversationMode, result);
  } catch { /* stats are best-effort */ }
  try {
    res.write(`data: ${JSON.stringify({ done: true, reply: result.reply, order: result.order, product: result.product, products: result.products })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch { /* client may have disconnected */ }
}

// GET /api/chat/diag — diagnostic endpoint
chatRouter.get("/diag", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const diag: any = {};
    diag.step1 = "started";

    const { getAppConfig } = await import("../lib/app-config.js");
    diag.step2 = "imported config";
    const config = await getAppConfig();
    diag.step3 = "got config";
    diag.hasGeminiKeys = config.geminiApiKeys.length > 0;
    diag.geminiKeyCount = config.geminiApiKeys.length;
    diag.geminiModels = config.geminiModels;
    diag.configSource = config.source;

    diag.step4 = "ok";
    res.json(diag);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat — text + optional image
chatRouter.post("/", (req: Request, res: Response) => {
  // Use setTimeout(0) to prevent Express 5's async handler detection from
  // interfering with the response lifecycle. This ensures the handler returns
  // before any async work begins, avoiding auto-next() behavior.
  setTimeout(async () => {
    try {
      await checkRateLimit(req.ip);
      const body = z.object({
        message: z.string().max(2000).default(""),
        imageBase64: z.string().nullable().optional(),
        imageMimeType: z.string().nullable().optional(),
        productId: z.string().nullable().optional(),
        productType: z.string().default("general"),
        conversationMode: z.string().default(""),
        history: z.array(z.any()).default([]),
        renderedProductIds: z.array(z.string()).default([]),
        orderConfirmed: z.boolean().default(false),
        stream: z.boolean().optional(),
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
        (async () => {
          try {
            if (!res.writableEnded) {
              await handleChatSSE(req, res, message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed, body.renderedProductIds);
            }
          } catch (e: any) {
            if (!res.writableEnded) { try { res.end(); } catch {} }
          }
        })();
        return;
      }

      const result = await generateChatResult(
        message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed, body.renderedProductIds
      );
      await recordConversationStats(req, body.conversationMode, result);
      if (!res.writableEnded) {
        res.json(result);
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        if (!res.writableEnded) {
          res.status(400).json({
            error: err.errors.map((issue: any) => issue.message).join(", "),
          });
        }
        return;
      }
      const errMsg = err && typeof err === "object" ? (err.message || String(err)) : String(err);
      logger.error("Chat error", { error: errMsg });
      if (!res.writableEnded) {
        const status = errorStatus(err);
        res.status(status).json({ error: status === 429 ? errMsg : "Erreur interne du serveur" });
      }
    }
  }, 0);
});

// POST /api/chat/voice — audio message
chatRouter.post("/voice", upload.single("audio"), async (req: Request, res: Response) => {
  try {
    await checkRateLimit(req.ip);

    if (!req.file) {
      return res.status(400).json({ error: "Fichier audio manquant" });
    }

    const audioBase64 = req.file.buffer.toString("base64");
    const audioMimeType = req.file.mimetype || "audio/webm";
    const message = ((req.body.message as string) || "").slice(0, 2000);
    const productId = (req.body.productId as string) || null;
    const productType = (req.body.productType as string) || "general";
    const conversationMode = (req.body.conversationMode as string) || "";

    let history: any[] = [];
    if (req.body.history) {
      try { history = JSON.parse(req.body.history as string); } catch { logger.warn("Invalid history JSON"); }
    }

    let renderedProductIds: string[] = [];
    if (req.body.renderedProductIds) {
      try { renderedProductIds = JSON.parse(req.body.renderedProductIds as string); } catch { logger.warn("Invalid renderedProductIds JSON"); }
    }

    const extraFields = { imageBase64: null, imageMimeType: null, audioBase64, audioMimeType };
    const wantsStream = req.query.stream === "1" || req.headers.accept?.includes("text/event-stream");
    if (wantsStream) {
      await handleChatSSE(req, res, message, extraFields, history, productId, conversationMode, true, productType, false, renderedProductIds);
      return;
    }

    const result = await generateChatResult(
      message, extraFields, history, productId, conversationMode, true, productType, false, renderedProductIds
    );
    await recordConversationStats(req, conversationMode, result);
    res.json(result);
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("Voice chat error", { error: errMsg });
    if (!res.headersSent) {
      const status = errorStatus(err);
      res.status(status).json({ error: status === 429 ? errMsg : "Erreur interne du serveur" });
    }
  }
});
