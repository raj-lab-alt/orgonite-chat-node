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

export const chatRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getConfig() {
  const appConfig = await getAppConfig();
  let products: any[] = [];
  try { const { data } = await supabase.from("products").select("*").eq("visible", true); if (data) products = data; } catch {}
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

async function generateChatResult(
  message: string,
  extraFields: any,
  history: any[],
  productId: string | null,
  conversationMode: string,
  isVoice: boolean,
  productType: string,
  orderConfirmed = false,
): Promise<ChatResult> {
  const { apiKeys, models, products, statuses, systemPrompt: dbSystemPrompt, catalogItemTemplate } = await getConfig();
  const catalog = catalogProducts(products);
  const systemPrompt = getSystemPrompt(catalog, dbSystemPrompt, catalogItemTemplate, productType);

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
    console.error("Gemini chat error:", err.message);
    fullReply = "Desole, une erreur est survenue. Veuillez reessayer.";
  }

  const visibleReply = sanitizeAssistantReply(fullReply);
  const { cleanReply, orderData } = detectOrderFromReply(visibleReply);
  let savedOrder = null;

  if (orderData) {
    const normalized = normalizeOrderPayload(orderData);
    normalized.id = generateOrderId();
    normalized.date = new Date().toISOString();
    normalized.statut = statuses[0];

    if (normalized.produit?.trim()) {
      applyOrderAmounts(normalized, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      const saved = await saveOrderWithoutDuplicate(normalized, statuses, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      savedOrder = orderResponse(saved.order, saved.created);
    }
  }

  const reply = stripPrematureUpsell(cleanReply || visibleReply, message, orderConfirmed, Boolean(savedOrder));
  const { productData, productList } = detectProductsFromReply(reply, products, {
    productId,
    productType,
    userMessage: recentConversationText(history, message),
  });

  return { reply, order: savedOrder, product: productData, products: productList };
}

async function handleChatSSE(
  res: Response,
  message: string,
  extraFields: any,
  history: any[],
  productId: string | null,
  conversationMode: string,
  isVoice: boolean,
  productType: string,
  orderConfirmed = false,
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const result = await generateChatResult(
    message, extraFields, history, productId, conversationMode, isVoice, productType, orderConfirmed
  );
  res.write(`data: ${JSON.stringify({ text: result.reply })}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

// POST /api/chat — text + optional image
chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    await checkRateLimit();
    const body = z.object({
      message: z.string().max(2000).default(""),
      imageBase64: z.string().nullable().optional(),
      imageMimeType: z.string().nullable().optional(),
      productId: z.string().nullable().optional(),
      productType: z.string().default("general"),
      conversationMode: z.string().default(""),
      history: z.array(z.any()).default([]),
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
      await handleChatSSE(res, message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed);
      return;
    }

    const result = await generateChatResult(
      message, extraFields, body.history, body.productId || null, body.conversationMode, false, body.productType, body.orderConfirmed
    );
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: err.errors.map((issue) => issue.message).join(", "),
      });
    }
    console.error("Chat error:", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// POST /api/chat/voice — audio message
chatRouter.post("/voice", upload.single("audio"), async (req: Request, res: Response) => {
  try {
    await checkRateLimit();

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
      try { history = JSON.parse(req.body.history as string); } catch {}
    }

    const extraFields = { imageBase64: null, imageMimeType: null, audioBase64, audioMimeType };
    const wantsStream = req.query.stream === "1" || req.headers.accept?.includes("text/event-stream");
    if (wantsStream) {
      await handleChatSSE(res, message, extraFields, history, productId, conversationMode, true, productType, false);
      return;
    }

    const result = await generateChatResult(
      message, extraFields, history, productId, conversationMode, true, productType, false
    );
    res.json(result);
  } catch (err: any) {
    console.error("Voice chat error:", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});
