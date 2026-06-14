import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { supabase } from "./supabase.js";
import { getLegacyConfig, getLegacyStatuses } from "./legacy-config.js";
import { memoize, cacheDel } from "./cache.js";
import { logger } from "./logger.js";

const DEFAULT_CATALOG_TEMPLATE =
  "{n}. {name} [RENDER_PRODUCT:{id}] : {benefits} Composition : {composition}{taille} Taille : {taille}.{/taille} Prix : {price} {currency}.";

export const DEFAULT_STATUSES = [
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

export interface AppConfig {
  systemPrompt: string;
  catalogItemTemplate: string;
  welcomeMessage: string;
  facebookPixelIds: string[];
  googleAnalyticsIds: string[];
  statuses: string[];
  geminiApiKeys: string[];
  geminiModels: string[];
  source: "database" | "seed";
}

type AppConfigUpdate = Partial<Omit<AppConfig, "source">>;

function splitEnvList(value: string | undefined) {
  return (value || "")
    .split(/[\r\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asStringList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const list = value.map((item) => String(item).trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function nonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

const KNOWN_GEMINI_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
]);

function validGeminiModels(models: string[]): string[] {
  const valid = models.filter((m) => KNOWN_GEMINI_MODELS.has(m));
  return valid.length > 0 ? valid : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
}

function readPromptFallback() {
  const promptFile = resolve(process.cwd(), "prompt-amine-structure.txt");
  if (!existsSync(promptFile)) return "";
  return readFileSync(promptFile, "utf-8");
}

function fallbackConfig(): AppConfig {
  const legacy = getLegacyConfig();
  const legacyStatuses = getLegacyStatuses();

  return {
    systemPrompt: readPromptFallback(),
    catalogItemTemplate: legacy.catalogItemTemplate || DEFAULT_CATALOG_TEMPLATE,
    welcomeMessage: legacy.welcomeMessage || process.env.WELCOME_MESSAGE || "",
    facebookPixelIds: asStringList(legacy.facebookPixelIds, splitEnvList(process.env.FACEBOOK_PIXEL_ID)),
    googleAnalyticsIds: asStringList(legacy.googleAnalyticsIds, splitEnvList(process.env.GA4_ID)),
    statuses: legacyStatuses.length ? legacyStatuses : DEFAULT_STATUSES,
    geminiApiKeys: splitEnvList(process.env.GEMINI_API_KEYS),
    geminiModels: validGeminiModels(splitEnvList(process.env.GEMINI_MODELS)),
    source: "seed",
  };
}

function rowToConfig(row: any, fallback: AppConfig): AppConfig {
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

function configToRow(config: AppConfigUpdate) {
  const row: Record<string, unknown> = {};
  if (config.systemPrompt !== undefined) row.system_prompt = config.systemPrompt;
  if (config.catalogItemTemplate !== undefined) row.catalog_item_template = config.catalogItemTemplate;
  if (config.welcomeMessage !== undefined) row.welcome_message = config.welcomeMessage;
  if (config.facebookPixelIds !== undefined) row.facebook_pixel_ids = config.facebookPixelIds;
  if (config.googleAnalyticsIds !== undefined) row.google_analytics_ids = config.googleAnalyticsIds;
  if (config.statuses !== undefined) row.statuses = config.statuses;
  if (config.geminiApiKeys !== undefined) row.gemini_api_keys = config.geminiApiKeys;
  if (config.geminiModels !== undefined) row.gemini_models = config.geminiModels;
  return row;
}

export function maskApiKeys(apiKeys: string[]) {
  return apiKeys.map(() => "***");
}

async function fetchAppConfig(): Promise<AppConfig> {
  const fallback = fallbackConfig();

  const { data, error } = await supabase
    .from("app_config")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    logger.warn("Falling back to seed config", { error: error.message });
    return fallback;
  }

  if (data) return rowToConfig(data, fallback);

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

  const { data: inserted, error: insertError } = await supabase
    .from("app_config")
    .insert(seedRow)
    .select()
    .single();

  if (insertError) {
    logger.error("Failed to seed database config", { error: insertError.message });
    return fallback;
  }

  return rowToConfig(inserted, fallback);
}

export async function getAppConfig(): Promise<AppConfig> {
  return memoize("app:config", fetchAppConfig, 30_000);
}

export async function updateAppConfig(update: AppConfigUpdate): Promise<AppConfig> {
  const row = configToRow(update);
  if (Object.keys(row).length === 0) return getAppConfig();

  const existing = await getAppConfig();
  const { data, error } = await supabase
    .from("app_config")
    .upsert({ id: true, ...configToRow(existing), ...row }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  cacheDel("app:config");
  return rowToConfig(data, existing);
}
