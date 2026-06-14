import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { logger } from "../lib/logger.js";

interface LegacyConfig {
  catalogItemTemplate?: string;
  welcomeMessage?: string;
  facebookPixelIds?: string[];
  googleAnalyticsIds?: string[];
  statuses?: string[];
  products?: any[];
  services?: any[];
}

let cachedConfig: LegacyConfig | null = null;

export function getLegacyConfig(): LegacyConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = resolve(__dirname, "../../config/legacy-config.json");
  if (!existsSync(configPath)) {
    cachedConfig = {};
    return cachedConfig;
  }

  try {
    const rawConfig = readFileSync(configPath, "utf-8").replace(/^\uFEFF/, "");
    cachedConfig = JSON.parse(rawConfig);
  } catch (err) {
    logger.error("Failed to read legacy config", { error: (err instanceof Error ? err.message : String(err)) });
    cachedConfig = {};
  }

  return cachedConfig ?? {};
}

export function getLegacyProducts() {
  const products = getLegacyConfig().products;
  return Array.isArray(products) ? products : [];
}

export function getLegacyServices() {
  const services = getLegacyConfig().services;
  return Array.isArray(services) ? services : [];
}

export function getLegacyStatuses() {
  const statuses = getLegacyConfig().statuses;
  return Array.isArray(statuses) ? statuses : [];
}
