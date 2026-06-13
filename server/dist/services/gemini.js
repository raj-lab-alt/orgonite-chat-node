"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiError = void 0;
exports.buildContents = buildContents;
exports.callGemini = callGemini;
exports.chatGeminiRequestStream = chatGeminiRequestStream;
function buildContents(messages) {
    const contents = [];
    for (const msg of messages) {
        const parts = [];
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
        const role = msg.role === "user" || msg.role === "model" ? msg.role : "user";
        contents.push({ role, parts });
    }
    return contents;
}
async function parseGeminiError(response) {
    const text = await response.text();
    let message = text || response.statusText || "Gemini request failed";
    try {
        const data = JSON.parse(text);
        message = data.error?.message || message;
    }
    catch {
        // Gemini/proxy outages can return plain text or HTML. Keep the HTTP status.
    }
    return new GeminiError(message, response.status);
}
async function callGemini(apiKey, model, contents, systemPrompt, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    if (onChunk) {
        // Streaming mode
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: { temperature: 0.7 },
            }),
        });
        if (!response.ok) {
            throw await parseGeminiError(response);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === "[DONE]")
                        continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (text) {
                            fullText += text;
                            onChunk(text);
                        }
                    }
                    catch {
                        // skip malformed SSE
                    }
                }
            }
        }
        return fullText;
    }
    else {
        // Non-streaming
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: { temperature: 0.7 },
            }),
        });
        if (!response.ok) {
            throw await parseGeminiError(response);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
}
class GeminiError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = "GeminiError";
        this.statusCode = statusCode;
    }
}
exports.GeminiError = GeminiError;
async function* chatGeminiRequestStream(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models) {
    if (!apiKeys.length)
        throw new Error("Aucune cle API Gemini configuree.");
    if (!models.length)
        throw new Error("Aucun modele Gemini configure.");
    const mode = (conversationMode || (productId === "orgonite_perso" ? "C" : productId ? "B" : "A")).toUpperCase();
    const trimmedHistory = history.slice(0, 100);
    const messages = [...trimmedHistory];
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
    const RENDER_REMINDER = "\n\n---\nINSTRUCTION STRICTE : Chaque fois que tu presentes, conseilles ou mentionnes un produit du catalogue, tu dois OBLIGATOIREMENT ecrire [RENDER_PRODUCT:id] a la fin de ton message, sans espace apres les deux-points. Exemple : [RENDER_PRODUCT:coeur_amethyste]. Ne termine JAMAIS une description produit sans cette balise.\n\nINTERDICTION ABSOLUE : N'invente JAMAIS un produit. Tu ne peux parler que des produits listes dans [CATALOGUE PRODUITS]. Si le prospect demande un produit hors catalogue, trouve le plus proche dans le catalogue ou reponds de maniere generale sans inventer de nom, prix ni description.";
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
    let lastErr = null;
    const state = {
        currentKeyIndex: 0,
        currentModelIndex: 0,
    };
    for (let mi = 0; mi < models.length; mi++) {
        const modelIdx = (state.currentModelIndex + mi) % models.length;
        const model = models[modelIdx];
        for (let ki = 0; ki < apiKeys.length; ki++) {
            const keyIdx = (state.currentKeyIndex + ki) % apiKeys.length;
            const apiKey = apiKeys[keyIdx];
            try {
                let fullText = "";
                const stream = callGemini(apiKey, model, contents, systemPrompt, (chunk) => {
                    fullText += chunk;
                });
                const result = await stream;
                yield result;
                return;
            }
            catch (err) {
                const code = err.statusCode || 500;
                const msg = err.message?.toLowerCase() || "";
                const isRateLimit = code === 429 || code === 503;
                const keyError = msg.includes("api key") || msg.includes("permission") || code === 401 || code === 403;
                const modelFallback = msg.includes("model") || msg.includes("not found") || msg.includes("not supported");
                const mediaUnsupported = msg.includes("does not support") || msg.includes("cannot read");
                if (isRateLimit || mediaUnsupported || keyError || modelFallback) {
                    lastErr = err;
                    continue;
                }
                throw err;
            }
        }
    }
    if (lastErr) {
        throw lastErr;
    }
    throw new Error("No available Gemini key/model combination.");
}
//# sourceMappingURL=gemini.js.map