"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiError = void 0;
exports.buildContents = buildContents;
exports.callGemini = callGemini;
exports.chatGeminiRequestStream = chatGeminiRequestStream;
const logger_js_1 = require("../lib/logger.js");
const reply_sanitize_js_1 = require("../lib/reply-sanitize.js");
const gemini_stats_js_1 = require("./gemini-stats.js");
const gemini_models_js_1 = require("./gemini-models.js");
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
async function* callGeminiStream(apiKey, model, contents, systemPrompt, signal) {
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
    if (!reader)
        throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
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
                    if (text)
                        yield text;
                }
                catch {
                    // skip malformed SSE
                }
            }
        }
    }
}
async function callGemini(apiKey, model, contents, systemPrompt) {
    let fullText = "";
    for await (const chunk of callGeminiStream(apiKey, model, contents, systemPrompt)) {
        fullText += chunk;
    }
    return fullText;
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
let globalKeyIndex = 0;
let globalModelIndex = 0;
let topModelIndex = 0;
const MIN_SOLID_SAMPLES = 10;
const KEY_COOLDOWN_MS = 5000;
const KEY_MIN_INTERVAL_MS = 2000;
const keyCooldowns = new Map();
const keyLastUsed = new Map();
async function waitKeyInterval(keyIndex) {
    const lastUsed = keyLastUsed.get(keyIndex) || 0;
    const elapsed = Date.now() - lastUsed;
    if (elapsed < KEY_MIN_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, KEY_MIN_INTERVAL_MS - elapsed));
    }
}
function getTopModels(models) {
    const stats = (0, gemini_stats_js_1.getModelStats)();
    const scored = stats.models
        .filter(m => m.requests >= MIN_SOLID_SAMPLES)
        .sort((a, b) => {
        if (b.successRate !== a.successRate)
            return b.successRate - a.successRate;
        if (b.winRate !== a.winRate)
            return b.winRate - a.winRate;
        return a.avgLatencyMs - b.avgLatencyMs;
    })
        .slice(0, 5)
        .map(m => m.model)
        .filter(m => models.includes(m));
    return scored.length >= 1 ? scored : null;
}
function pickModel(models) {
    const topModels = getTopModels(models);
    if (topModels) {
        const idx = topModelIndex++ % topModels.length;
        return topModels[idx];
    }
    return models[globalModelIndex++ % models.length];
}
function pickKeyIndex(apiKeysLength) {
    for (let i = 0; i < apiKeysLength; i++) {
        const idx = globalKeyIndex++ % apiKeysLength;
        const until = keyCooldowns.get(idx);
        if (!until || Date.now() > until)
            return idx;
    }
    // All keys in cooldown — pick the next one anyway
    return globalKeyIndex++ % apiKeysLength;
}
function sanitizeEtatOutput(text) {
    text = (0, reply_sanitize_js_1.stripInternalDiagnostics)(text);
    text = text.replace(/\{\s*(\w+)\}\s*=/g, '$1=');
    return text;
}
function maybeDiagnosticPrefix(text) {
    const trimmed = text.trimStart().toUpperCase();
    if (!trimmed)
        return true;
    const markers = [
        "[ETAT", "[ÉTAT", "[LANGUE", "[DEBUG", "[DIAG", "[STATE", "[ANALYSE", "[ANALYSIS",
        "<ETAT", "<LANGUE", "<DEBUG", "<DIAG", "<STATE", "<ANALYSE", "<ANALYSIS",
        "ETAT", "ÉTAT", "LANGUE", "DEBUG", "DIAG", "STATE", "ANALYSE", "ANALYSIS",
        "LANG=", "{LANG", "MODE=", "{MODE", "TYPE=", "{TYPE", "INTENT=", "{INTENT",
        "[[ETAT", "[[ÉTAT", "[[LANGUE", "[[DEBUG", "[[DIAG", "[[STATE", "[[ANALYSE", "[[ANALYSIS",
    ];
    return markers.some((marker) => marker.startsWith(trimmed) || trimmed.startsWith(marker));
}
async function* chatGeminiRequestStream(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models, retryDepth = 0) {
    if (!apiKeys.length)
        throw new Error("Aucune cle API Gemini configuree.");
    // Auto-refresh if models list is empty (first use)
    if (models.length === 0) {
        models = await (0, gemini_models_js_1.refreshModelList)(apiKeys[0]);
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
    // Sequential retry — try best model+key combos first (by stats), fallback round-robin
    let lastError;
    for (let attempt = 0; attempt < models.length; attempt++) {
        const model = pickModel(models);
        const keyIndex = pickKeyIndex(apiKeys.length);
        const apiKey = apiKeys[keyIndex];
        await waitKeyInterval(keyIndex);
        const startTime = Date.now();
        let recorded = false;
        let prefixBuf = '';
        let prefixResolved = false;
        try {
            keyLastUsed.set(keyIndex, Date.now());
            for await (const chunk of callGeminiStream(apiKey, model, contents, systemPrompt)) {
                if (!recorded) {
                    recorded = true;
                    (0, gemini_stats_js_1.recordAttempt)({
                        model, keyIndex, success: true, winner: true,
                        latencyMs: Date.now() - startTime,
                    });
                }
                if (!prefixResolved) {
                    prefixBuf += chunk;
                    const sanitized = sanitizeEtatOutput(prefixBuf);
                    const hasSeparator = prefixBuf.includes("-----");
                    const strippedSomething = sanitized !== prefixBuf.trimStart();
                    if (!hasSeparator && !strippedSomething && prefixBuf.length < 80 && maybeDiagnosticPrefix(prefixBuf)) {
                        continue;
                    }
                    prefixResolved = true;
                    prefixBuf = '';
                    if (sanitized)
                        yield sanitized;
                    continue;
                }
                yield sanitizeEtatOutput(chunk);
            }
            if (!prefixResolved && prefixBuf) {
                const sanitized = sanitizeEtatOutput(prefixBuf);
                if (sanitized)
                    yield sanitized;
            }
            if (!recorded) {
                (0, gemini_stats_js_1.recordAttempt)({
                    model, keyIndex, success: true, winner: true,
                    latencyMs: Date.now() - startTime,
                });
            }
            return;
        }
        catch (err) {
            if (!recorded) {
                (0, gemini_stats_js_1.recordAttempt)({
                    model, keyIndex, success: false, winner: false,
                    latencyMs: Date.now() - startTime,
                });
            }
            lastError = err;
            if (err.statusCode === 429) {
                keyCooldowns.set(keyIndex, Date.now() + KEY_COOLDOWN_MS);
                await new Promise(r => setTimeout(r, 3000));
            }
            continue;
        }
    }
    // All models failed with 429 — wait and retry once
    if (retryDepth < 1 && lastError && lastError.statusCode === 429) {
        await new Promise(r => setTimeout(r, 5000));
        return yield* chatGeminiRequestStream(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, models, retryDepth + 1);
    }
    // Try refreshing the model list and retry once
    try {
        const newModels = await (0, gemini_models_js_1.refreshModelList)(apiKeys[0]);
        const changed = newModels.length !== models.length ||
            newModels.some((m, i) => m !== models[i]);
        if (changed) {
            logger_js_1.logger.info(`Retrying with refreshed models: ${newModels.join(", ")}`);
            return yield* chatGeminiRequestStream(message, extraFields, history, productId, conversationMode, isVoice, productType, systemPrompt, apiKeys, newModels);
        }
    }
    catch { }
    throw lastError || new Error("Tous les modeles ont echoue.");
}
//# sourceMappingURL=gemini.js.map