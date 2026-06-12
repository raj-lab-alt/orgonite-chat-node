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

export const chatRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const DEFAULT_STATUSES = [
  "attente de confirm tel", "cde double", "a expedier", "injoignable",
  "confirmee att. env.", "livree", "echouee", "nn qualifiee", "Annulee",
];

async function getConfig() {
  const apiKeys = (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean);
  const models = (process.env.GEMINI_MODELS || "gemini-2.5-flash").split(",").filter(Boolean);
  let products: any[] = [];
  try { const { data } = await supabase.from("products").select("*").eq("visible", true); if (data) products = data; } catch {}
  return { apiKeys, models, products };
}

function catalogProducts(products: any[]) {
  return products.map((p: any) => ({
    id: p.id, name: p.name, price: p.price, currency: p.currency,
    benefits: p.benefits, composition: p.composition || "", taille: p.taille || "",
  }));
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
) {
  const { apiKeys, models, products } = await getConfig();
  const catalog = catalogProducts(products);
  const systemPrompt = getSystemPrompt(catalog, undefined, undefined, productType);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let fullReply = "";

  try {
    const stream = chatGeminiRequestStream(
      message, extraFields, history, productId, conversationMode,
      isVoice, productType, systemPrompt, apiKeys, models
    );

    for await (const chunk of stream) {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
  } catch (err: any) {
    console.error("Gemini stream error:", err.message);
    const errorReply = "Desole, une erreur est survenue. Veuillez reessayer.";
    res.write(`data: ${JSON.stringify({ text: errorReply })}\n\n`);
    fullReply = errorReply;
  }

  // Process order
  const { cleanReply, orderData } = detectOrderFromReply(fullReply);
  let savedOrder = null;

  if (orderData) {
    const normalized = normalizeOrderPayload(orderData);
    normalized.id = generateOrderId();
    normalized.date = new Date().toISOString();
    normalized.statut = DEFAULT_STATUSES[0];

    if (normalized.produit?.trim()) {
      applyOrderAmounts(normalized, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      const saved = await saveOrderWithoutDuplicate(normalized, DEFAULT_STATUSES, products.map((p: any) => ({ name: p.name, price: p.price, id: p.id })));
      savedOrder = orderResponse(saved.order, saved.created);
    }
  }

  const { productData, productList } = detectProductsFromReply(cleanReply || fullReply, products);

  res.write(`data: ${JSON.stringify({ done: true, reply: cleanReply || fullReply, order: savedOrder, product: productData, products: productList })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

// POST /api/chat — text + optional image
chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    await checkRateLimit();
    const body = z.object({
      message: z.string().min(1).max(2000),
      imageBase64: z.string().optional(),
      imageMimeType: z.string().optional(),
      productId: z.string().nullable().optional(),
      productType: z.string().default("general"),
      conversationMode: z.string().default(""),
      history: z.array(z.any()).default([]),
      orderConfirmed: z.boolean().default(false),
    }).parse(req.body);

    let message = body.message;
    if (body.orderConfirmed) {
      message = `[INSTRUCTION]Le prospect a deja confirme sa commande via la modale. NE PAS demander de confirmation ni re-presenter l'outil. Suivre le Closing normal etape par etape (nom → gouvernorat → adresse → telephone → disponibilite). Une fois la commande creee avec <ORDER>, AVANT d'envoyer le message de confirmation finale, proposer OBLIGATOIREMENT l'upsell livraison offerte des 2 outils. Ne pas sauter l'upsell.[/INSTRUCTION] ${message}`;
    }

    await handleChatSSE(res, message, {
      imageBase64: body.imageBase64 || null,
      imageMimeType: body.imageMimeType || null,
      audioBase64: null,
      audioMimeType: null,
    }, body.history, body.productId || null, body.conversationMode, false, body.productType);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
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

    await handleChatSSE(res, message, { imageBase64: null, imageMimeType: null, audioBase64, audioMimeType },
      history, productId, conversationMode, true, productType);
  } catch (err: any) {
    console.error("Voice chat error:", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});
