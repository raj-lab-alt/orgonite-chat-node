"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STATUSES = void 0;
exports.maskApiKeys = maskApiKeys;
exports.getAppConfig = getAppConfig;
exports.updateAppConfig = updateAppConfig;
const fs_1 = require("fs");
const path_1 = require("path");
const supabase_js_1 = require("./supabase.js");
const legacy_config_js_1 = require("./legacy-config.js");
const cache_js_1 = require("./cache.js");
const logger_js_1 = require("./logger.js");
const DEFAULT_CATALOG_TEMPLATE = "{n}. {name} [RENDER_PRODUCT:{id}] : {benefits} Composition : {composition}{taille} Taille : {taille}.{/taille} Prix : {price} {currency}.";
exports.DEFAULT_STATUSES = [
    "attente de confirm tel",
    "cde double",
    "a expedier",
    "injoignable",
    "confirmee att. env.",
    "livree",
    "echouee",
    "nn qualifiee",
    "Annulee",
];
function splitEnvList(value) {
    return (value || "")
        .split(/[\r\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function asStringList(value, fallback = []) {
    if (!Array.isArray(value))
        return fallback;
    const list = value.map((item) => String(item).trim()).filter(Boolean);
    return list.length ? list : fallback;
}
function nonEmptyString(value, fallback) {
    return typeof value === "string" && value.trim() ? value : fallback;
}
function validGeminiModels(models) {
    const valid = models.filter((m) => /^gemini-/.test(m));
    return valid.length > 0 ? valid : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
}
function readPromptFallback() {
    const promptFile = (0, path_1.resolve)(process.cwd(), "prompt-amine-structure.txt");
    if (!(0, fs_1.existsSync)(promptFile))
        return "";
    return (0, fs_1.readFileSync)(promptFile, "utf-8");
}
function fallbackConfig() {
    const legacy = (0, legacy_config_js_1.getLegacyConfig)();
    const legacyStatuses = (0, legacy_config_js_1.getLegacyStatuses)();
    return {
        systemPrompt: readPromptFallback(),
        catalogItemTemplate: legacy.catalogItemTemplate || DEFAULT_CATALOG_TEMPLATE,
        welcomeMessage: legacy.welcomeMessage || process.env.WELCOME_MESSAGE || "",
        facebookPixelIds: asStringList(legacy.facebookPixelIds, splitEnvList(process.env.FACEBOOK_PIXEL_ID)),
        googleAnalyticsIds: asStringList(legacy.googleAnalyticsIds, splitEnvList(process.env.GA4_ID)),
        statuses: legacyStatuses.length ? legacyStatuses : exports.DEFAULT_STATUSES,
        geminiApiKeys: splitEnvList(process.env.GEMINI_API_KEYS),
        geminiModels: validGeminiModels(splitEnvList(process.env.GEMINI_MODELS)),
        source: "seed",
    };
}
function rowToConfig(row, fallback) {
    return {
        systemPrompt: nonEmptyString(row.system_prompt, fallback.systemPrompt),
        catalogItemTemplate: nonEmptyString(row.catalog_item_template, fallback.catalogItemTemplate),
        welcomeMessage: nonEmptyString(row.welcome_message, fallback.welcomeMessage),
        facebookPixelIds: asStringList(row.facebook_pixel_ids, fallback.facebookPixelIds),
        googleAnalyticsIds: asStringList(row.google_analytics_ids, fallback.googleAnalyticsIds),
        statuses: asStringList(row.statuses, fallback.statuses),
        geminiApiKeys: asStringList(row.gemini_api_keys, fallback.geminiApiKeys),
        geminiModels: validGeminiModels(asStringList(row.gemini_models, fallback.geminiModels)),
        source: "database",
    };
}
function configToRow(config) {
    const row = {};
    if (config.systemPrompt !== undefined)
        row.system_prompt = config.systemPrompt;
    if (config.catalogItemTemplate !== undefined)
        row.catalog_item_template = config.catalogItemTemplate;
    if (config.welcomeMessage !== undefined)
        row.welcome_message = config.welcomeMessage;
    if (config.facebookPixelIds !== undefined)
        row.facebook_pixel_ids = config.facebookPixelIds;
    if (config.googleAnalyticsIds !== undefined)
        row.google_analytics_ids = config.googleAnalyticsIds;
    if (config.statuses !== undefined)
        row.statuses = config.statuses;
    if (config.geminiApiKeys !== undefined)
        row.gemini_api_keys = config.geminiApiKeys;
    if (config.geminiModels !== undefined)
        row.gemini_models = config.geminiModels;
    return row;
}
function maskApiKeys(apiKeys) {
    return apiKeys.map(() => "***");
}
async function fetchAppConfig() {
    const fallback = fallbackConfig();
    const { data, error } = await supabase_js_1.supabase
        .from("app_config")
        .select("*")
        .eq("id", true)
        .maybeSingle();
    if (error) {
        logger_js_1.logger.warn("Falling back to seed config", { error: error.message });
        return fallback;
    }
    if (data)
        return rowToConfig(data, fallback);
    const seedRow = {
        id: true,
        system_prompt: fallback.systemPrompt,
        catalog_item_template: fallback.catalogItemTemplate,
        welcome_message: fallback.welcomeMessage,
        facebook_pixel_ids: fallback.facebookPixelIds,
        google_analytics_ids: fallback.googleAnalyticsIds,
        statuses: fallback.statuses,
        gemini_api_keys: fallback.geminiApiKeys,
        gemini_models: fallback.geminiModels,
    };
    const { data: inserted, error: insertError } = await supabase_js_1.supabase
        .from("app_config")
        .insert(seedRow)
        .select()
        .single();
    if (insertError) {
        logger_js_1.logger.error("Failed to seed database config", { error: insertError.message });
        return fallback;
    }
    return rowToConfig(inserted, fallback);
}
async function getAppConfig() {
    return (0, cache_js_1.memoize)("app:config", fetchAppConfig, 30_000);
}
async function updateAppConfig(update) {
    const row = configToRow(update);
    if (Object.keys(row).length === 0)
        return getAppConfig();
    const existing = await getAppConfig();
    const { data, error } = await supabase_js_1.supabase
        .from("app_config")
        .upsert({ id: true, ...configToRow(existing), ...row }, { onConflict: "id" })
        .select()
        .single();
    if (error)
        throw error;
    (0, cache_js_1.cacheDel)("app:config");
    return rowToConfig(data, existing);
}
//# sourceMappingURL=app-config.js.map