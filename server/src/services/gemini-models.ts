import { logger } from "../lib/logger.js";
import { updateAppConfig, getAppConfig } from "../lib/app-config.js";

const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const REFRESH_DEBOUNCE_MS = 30_000;

let lastRefreshTime = 0;
let cachedModels: string[] | null = null;

export function getCachedModels(): string[] | null {
  return cachedModels;
}

export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini API error: ${response.status} ${text.slice(0, 200)}`);
  }

  const data: any = await response.json();
  const models: string[] = (data.models || [])
    .map((m: any) => m.name)
    .filter((name: string) => /^models\/gemini-/.test(name))
    .map((name: string) => name.replace(/^models\//, ""))
    .sort((a: string, b: string) => b.localeCompare(a));

  if (models.length === 0) {
    throw new Error("Aucun modele Gemini trouve dans la reponse API");
  }

  return models;
}

export async function refreshModelList(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_DEBOUNCE_MS && cachedModels) {
    return cachedModels;
  }

  try {
    const models = await fetchAvailableModels(apiKey);
    lastRefreshTime = Date.now();
    cachedModels = [...models];

    await updateAppConfig({ geminiModels: models });
    logger.info(`Gemini models refreshed: ${models.join(", ")}`);

    return models;
  } catch (err: any) {
    logger.warn("Failed to refresh Gemini models", { error: err.message });

    if (cachedModels) return cachedModels;

    try {
      const config = await getAppConfig();
      if (config.geminiModels.length > 0) {
        cachedModels = [...config.geminiModels];
        return cachedModels;
      }
    } catch {}

    return FALLBACK_MODELS;
  }
}
