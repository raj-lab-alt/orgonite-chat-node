"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLegacyConfig = getLegacyConfig;
exports.getLegacyProducts = getLegacyProducts;
exports.getLegacyServices = getLegacyServices;
exports.getLegacyStatuses = getLegacyStatuses;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_js_1 = require("../lib/logger.js");
let cachedConfig = null;
function getLegacyConfig() {
    if (cachedConfig)
        return cachedConfig;
    const configPath = (0, path_1.resolve)(__dirname, "../../config/legacy-config.json");
    if (!(0, fs_1.existsSync)(configPath)) {
        cachedConfig = {};
        return cachedConfig;
    }
    try {
        const rawConfig = (0, fs_1.readFileSync)(configPath, "utf-8").replace(/^\uFEFF/, "");
        cachedConfig = JSON.parse(rawConfig);
    }
    catch (err) {
        logger_js_1.logger.error("Failed to read legacy config", { error: (err instanceof Error ? err.message : String(err)) });
        cachedConfig = {};
    }
    return cachedConfig ?? {};
}
function getLegacyProducts() {
    const products = getLegacyConfig().products;
    return Array.isArray(products) ? products : [];
}
function getLegacyServices() {
    const services = getLegacyConfig().services;
    return Array.isArray(services) ? services : [];
}
function getLegacyStatuses() {
    const statuses = getLegacyConfig().statuses;
    return Array.isArray(statuses) ? statuses : [];
}
//# sourceMappingURL=legacy-config.js.map