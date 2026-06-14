import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { recordAttempt, getModelStats } from "./gemini-stats.js";
import { refreshModelList } from "./gemini-models.js";

interface GeminiContent {
  role: "user" | "model";
  parts: { text?: string; inline_data?: { data: string; mime_type: string } }[];
}

interface ChatMessage {
  role: string;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

export function buildContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    const parts: GeminiContent["parts"] = [];

    if (msg.imageBase64 && msg.imageMimeType) {
      parts.push({
        inline_data: {
          data: msg.imageBase64,
          mime_type: msg.imageMimeType,
        },
      });
    }

    if (msg.audioBase64 && msg.audioMimeType) {
      parts.push({
        inline_data: {
          data: msg.audioBase64,
          mime_type: msg.audioMimeType,
        },
      });
    }

    if (msg.text) {
      parts.push({ text: msg.text });
    }

    const role =
      msg.role === "user" || msg.role === "model" ? msg.role : "user";
    contents.push({ role, parts });
  }

  return contents;
}

async function parseGeminiError(response: Response): Promise<GeminiError> {
  const text = await response.text();
  let message = text || response.statusText || "Gemini request failed";

  try {
    const data = JSON.parse(text);
    message = data.error?.message || message;
  } catch {
    // Gemini/proxy outages can return plain text or HTML. Keep the HTTP status.
  }

  return new GeminiError(message, response.status);
}

async function* callGeminiStream(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  systemPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7 },
    }),
    signal,
  });

  if (!response.ok) {
    throw await parseGeminiError(response);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const data = JSON.parse(jsonStr);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) yield text;
        } catch {
          // skip malformed SSE
        }
      }
    }
  }
}

export async function callGemini(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  systemPrompt: string,
): Promise<string> {
  let fullText = "";
  for await (const chunk of callGeminiStream(apiKey, model, contents, systemPrompt)) {
    fullText += chunk;
  }
  return fullText;
}

export class GeminiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "GeminiError";
    this.statusCode = statusCode;
  }
}

let globalKeyIndex = 0;
let globalModelIndex = 0;
let topModelIndex = 0;

const MIN_SOLID_SAMPLES = 10;

function getTopModels(models: string[]): string[] | null {
  const stats = getModelStats();
  const scored = stats.models
    .filter(m => m.requests >= MIN_SOLID_SAMPLES)
    .sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.avgLatencyMs - b.avgLatencyMs;
    })
    .slice(0, 5)
    .map(m => m.model)
    .filter(m => models.includes(m));
  return scored.length >= 1 ? scored : null;
}

function pickModel(models: string[]): string {
  const topModels = getTopModels(models);
  if (topModels) {
    const idx = topModelIndex++ % topModels.length;
    return topModels[idx];
  }
  return models[globalModelIndex++ % models.length];
}

function pickKeyIndex(apiKeysLength: number): number {
  return globalKeyIndex++ % apiKeysLength;
}

function sanitizeEtatOutput(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    if (line.includes('[ETAT]') || line.includes('[LANGUE]')) {
      line = line.replace(/\{(\w+)\}=/g, '$1=');
      line = line.replace(/\{\s*/g, '');
    }
    return line;
  }).join('\n');
}

export async function* chatGeminiRequestStream(
  message: string,
  extraFields: { imageBase64?: string | null; imageMimeType?: string | null; audioBase64?: string | null; audioMimeType?: string | null },
  history: ChatMessage[],
  productId: string | null,
  conversationMode: string,
  isVoice: boolean,
  productType: string,
  systemPrompt: string,
  apiKeys: string[],
  models: string[]
): AsyncGenerator<string> {
  if (!apiKeys.length) throw new Error("Aucune cle API Gemini configuree.");

  // Auto-refresh if models list is empty (first use)
  if (models.length === 0) {
    models = await refreshModelList(apiKeys[0]);
  }
  // Ultimate fallback if refresh also failed
  if (models.length === 0) {
    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  }

  const mode = (conversationMode || (productId === "orgonite_perso" ? "C" : productId ? "B" : "A")).toUpperCase();
  const trimmedHistory = history.slice(0, 100).map(msg => ({
    ...msg,
    text: msg.text ? sanitizeEtatOutput(msg.text) : msg.text,
  }));
  const messages: ChatMessage[] = [...trimmedHistory];

  // Mode A first message prevention
  const firstMessage = history.length === 0;
  if (mode === "A" && firstMessage) {
    messages.push({
      role: "user",
      text: "[CONTEXTE] Prospect sur page d'accueil. Message de bienvenue deja affiche au-dessus du chat. Tu as deja accueilli ce visiteur. NE salue PAS, NE te presente PAS, ne dis PAS 'Marhba bik'. Reponds directement et naturellement en francais.",
    });
    messages.push({ role: "model", text: "[OK]" });
  }

  const modePrefix = `[MODE ${mode}] `;
  const RENDER_REMINDER =
    "\n\n---\nINSTRUCTION STRICTE : Chaque fois que tu presentes, conseilles ou mentionnes un produit du catalogue, tu dois OBLIGATOIREMENT ecrire [RENDER_PRODUCT:id] a la fin de ton message, sans espace apres les deux-points. Exemple : [RENDER_PRODUCT:coeur_amethyste]. Ne termine JAMAIS une description produit sans cette balise.\n\nINTERDICTION ABSOLUE : N'invente JAMAIS un produit. Tu ne peux parler que des produits listes dans [CATALOGUE PRODUITS]. Si le prospect demande un produit hors catalogue, trouve le plus proche dans le catalogue ou reponds de maniere generale sans inventer de nom, prix ni description.";
  messages.push({
    role: "user",
    text: modePrefix + message + RENDER_REMINDER,
    ...(extraFields.imageBase64 && {
      imageBase64: extraFields.imageBase64,
      imageMimeType: extraFields.imageMimeType || "image/jpeg",
    }),
    ...(extraFields.audioBase64 && {
      audioBase64: extraFields.audioBase64,
      audioMimeType: extraFields.audioMimeType || "audio/webm",
    }),
  });

  const contents = buildContents(messages);

  // Sequential retry — try best model+key combos first (by stats), fallback round-robin
  let lastError: unknown;
  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = pickModel(models);
    const keyIndex = pickKeyIndex(apiKeys.length);
    const apiKey = apiKeys[keyIndex];

    const startTime = Date.now();
    let recorded = false;
    try {
      for await (const chunk of callGeminiStream(apiKey, model, contents, systemPrompt)) {
        if (!recorded) {
          recorded = true;
          recordAttempt({
            model, keyIndex, success: true, winner: true,
            latencyMs: Date.now() - startTime,
          });
        }
        yield sanitizeEtatOutput(chunk);
      }
      if (!recorded) {
        // Stream completed without yielding — still a success (empty response)
        recordAttempt({
          model, keyIndex, success: true, winner: true,
          latencyMs: Date.now() - startTime,
        });
      }
      return;
    } catch (err: any) {
      if (!recorded) {
        recordAttempt({
          model, keyIndex, success: false, winner: false,
          latencyMs: Date.now() - startTime,
        });
      }
      lastError = err;
      if (err.statusCode === 429) {
        await new Promise(r => setTimeout(r, 1000));
      }
      continue;
    }
  }

  // All models failed — try refreshing the model list and retry once
  try {
    const newModels = await refreshModelList(apiKeys[0]);
    const changed = newModels.length !== models.length ||
      newModels.some((m, i) => m !== models[i]);
    if (changed) {
      logger.info(`Retrying with refreshed models: ${newModels.join(", ")}`);
      return yield* chatGeminiRequestStream(
        message, extraFields, history, productId, conversationMode,
        isVoice, productType, systemPrompt, apiKeys, newModels
      );
    }
  } catch {}
  throw lastError || new Error("Tous les modeles ont echoue.");
}
