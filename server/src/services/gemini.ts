import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { recordAttempt } from "./gemini-stats.js";
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

async function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) reject(new Error("No promises"));
    let failures = 0;
    for (const p of promises) {
      p.then(resolve, () => {
        failures++;
        if (failures === promises.length)
          reject(new Error("All promises failed"));
      });
    }
  });
}

async function takeFirstChunk(
  stream: AsyncGenerator<string>
): Promise<{ firstChunk: string; rest: AsyncGenerator<string> } | null> {
  try {
    const { value, done } = await stream.next();
    if (done) return null;
    async function* rest() {
      yield value;
      yield* stream;
    }
    return { firstChunk: value, rest: rest() };
  } catch {
    return null;
  }
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

  const mode = (conversationMode || (productId === "orgonite_perso" ? "C" : productId ? "B" : "A")).toUpperCase();
  const trimmedHistory = history.slice(0, 100);
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

  // Key rotation: pick next key in round-robin
  const keyIndex = globalKeyIndex++ % apiKeys.length;
  const apiKey = apiKeys[keyIndex];

  // Launch all models in parallel with the chosen key
  const controllers = models.map(() => new AbortController());
  const startTimes = new Array<number>(models.length);
  const streams = models.map((model, i) =>
    callGeminiStream(apiKey, model, contents, systemPrompt, controllers[i].signal)
  );

  // Race for first chunk across all models
  const firstChunkPromises = streams.map(async (stream, i) => {
    startTimes[i] = Date.now();
    const result = await takeFirstChunk(stream);
    if (!result) throw new Error("Empty stream");
    return { ...result, index: i, latencyMs: Date.now() - startTimes[i] };
  });

  // Prevent unhandled rejections from losers that get aborted
  for (const p of firstChunkPromises) p.catch(() => {});

  let winner: Awaited<(typeof firstChunkPromises)[number]>;

  try {
    winner = await firstSuccess(firstChunkPromises);
  } catch (firstErr: any) {
    controllers.forEach(c => { try { c.abort(); } catch {} });
    for (let i = 0; i < models.length; i++) {
      recordAttempt({
        model: models[i],
        keyIndex,
        success: false,
        winner: false,
        latencyMs: startTimes[i] ? Date.now() - startTimes[i] : 0,
      });
    }

    // All models failed — try refreshing the model list and retry once
    try {
      const newModels = await refreshModelList(apiKeys[0]);
      const changed = newModels.length !== models.length ||
        newModels.some((m, i) => m !== models[i]);
      if (!changed) throw firstErr;

      logger.info(`Retrying with refreshed models: ${newModels.join(", ")}`);
      return yield* chatGeminiRequestStream(
        message, extraFields, history, productId, conversationMode,
        isVoice, productType, systemPrompt, apiKeys, newModels
      );
    } catch {
      throw firstErr;
    }
  }

  // Abort all loser models
  controllers.forEach((c, i) => { if (i !== winner.index) { try { c.abort(); } catch {} } });

  // Record stats: winner is success, losers are non-success (aborted)
  for (let i = 0; i < models.length; i++) {
    recordAttempt({
      model: models[i],
      keyIndex,
      success: i === winner.index,
      winner: i === winner.index,
      latencyMs: i === winner.index ? winner.latencyMs : (startTimes[i] ? Date.now() - startTimes[i] : 0),
    });
  }

  // Yield from winner
  yield winner.firstChunk;
  for await (const chunk of winner.rest) {
    yield chunk;
  }
}
