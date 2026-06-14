"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedModels = getCachedModels;
exports.fetchAvailableModels = fetchAvailableModels;
exports.refreshModelList = refreshModelList;
const logger_js_1 = require("../lib/logger.js");
const app_config_js_1 = require("../lib/app-config.js");
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const REFRESH_DEBOUNCE_MS = 30_000;
let lastRefreshTime = 0;
let cachedModels = null;
function getCachedModels() {
    return cachedModels;
}
async function fetchAvailableModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Gemini API error: ${response.status} ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    const models = (data.models || [])
        .map((m) => m.name)
        .filter((name) => /^models\/gemini-/.test(name))
        .map((name) => name.replace(/^models\//, ""))
        .sort((a, b) => b.localeCompare(a));
    if (models.length === 0) {
        throw new Error("Aucun modele Gemini trouve dans la reponse API");
    }
    return models;
}
async function refreshModelList(apiKey) {
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_DEBOUNCE_MS && cachedModels) {
        return cachedModels;
    }
    try {
        const models = await fetchAvailableModels(apiKey);
        lastRefreshTime = Date.now();
        cachedModels = [...models];
        await (0, app_config_js_1.updateAppConfig)({ geminiModels: models });
        logger_js_1.logger.info(`Gemini models refreshed: ${models.join(", ")}`);
        return models;
    }
    catch (err) {
        logger_js_1.logger.warn("Failed to refresh Gemini models", { error: err.message });
        if (cachedModels)
            return cachedModels;
        try {
            const config = await (0, app_config_js_1.getAppConfig)();
            if (config.geminiModels.length > 0) {
                cachedModels = [...config.geminiModels];
                return cachedModels;
            }
        }
        catch { }
        return FALLBACK_MODELS;
    }
}
//# sourceMappingURL=gemini-models.js.map