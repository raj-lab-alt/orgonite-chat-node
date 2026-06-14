"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const fs_1 = require("fs");
const http_1 = require("http");
const uuid_1 = require("uuid");
const chat_js_1 = require("./routes/chat.js");
const orders_js_1 = require("./routes/orders.js");
const products_js_1 = require("./routes/products.js");
const services_js_1 = require("./routes/services.js");
const admin_js_1 = require("./routes/admin.js");
const tracking_js_1 = require("./routes/tracking.js");
const auth_js_1 = require("./middleware/auth.js");
const logger_js_1 = require("./lib/logger.js");
const cache_js_1 = require("./lib/cache.js");
const supabase_js_1 = require("./lib/supabase.js");
const admin_ws_js_1 = require("./lib/admin-ws.js");
dotenv_1.default.config({ path: (0, path_1.resolve)(__dirname, "../../.env") });
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "GEMINI_API_KEYS"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
    logger_js_1.logger.warn(`ENV manquantes: ${missing.join(", ")}. API features may be degraded until configured.`);
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.set("trust proxy", 1);
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express_1.default.json({ limit: "20mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "20mb" }));
app.use((req, _res, next) => {
    req.requestId = (0, uuid_1.v4)();
    next();
});
app.use((req, res, next) => {
    const start = Date.now();
    const rid = req.requestId;
    res.on("finish", () => {
        const ms = Date.now() - start;
        const ctx = { requestId: rid, method: req.method, path: req.originalUrl, status: res.statusCode, ms };
        if (res.statusCode >= 500)
            logger_js_1.logger.error("Request failed", ctx);
        else if (res.statusCode >= 400)
            logger_js_1.logger.warn("Request warning", ctx);
        else
            logger_js_1.logger.info("Request OK", ctx);
    });
    next();
});
app.use("/api/chat", chat_js_1.chatRouter);
app.use("/api/orders", orders_js_1.ordersRouter);
app.use("/api/products", products_js_1.productsRouter);
app.use("/api/services", services_js_1.servicesRouter);
app.use("/api/admin/products", auth_js_1.requireAdmin, products_js_1.productsRouter);
app.use("/api/admin/services", auth_js_1.requireAdmin, services_js_1.servicesRouter);
app.use("/api/admin", admin_js_1.adminRouter);
app.use("/api", tracking_js_1.trackingRouter);
app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Route API introuvable" });
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use((err, _req, res, _next) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger_js_1.logger.error("Unhandled error", { error: msg });
    if (err instanceof Error)
        logger_js_1.logger.error(err.stack || "");
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV !== "production" ? msg : undefined,
    });
});
// Prefer dist-react/ (React build), fall back to dist/ (legacy PHP)
const reactDist = (0, path_1.resolve)(__dirname, "../../client/dist-react");
const legacyDist = (0, path_1.resolve)(__dirname, "../../client/dist");
const reactExists = (0, fs_1.existsSync)(reactDist);
const clientDist = reactExists ? reactDist : legacyDist;
const adminHtml = (0, path_1.resolve)(clientDist, "admin.html");
const adminExists = (0, fs_1.existsSync)(adminHtml);
console.log("[server] Serving from:", clientDist, "(reactBuild:", reactExists, ")");
if ((0, fs_1.existsSync)(clientDist)) {
    app.use(express_1.default.static(clientDist));
    app.get(["/admin", "/admin/"], (_req, res) => {
        if (adminExists) {
            res.sendFile(adminHtml);
        }
        else {
            res.sendFile((0, path_1.resolve)(clientDist, "index.html"));
        }
    });
    if (adminExists) {
        app.get("/sitemap.xml", (_req, res) => {
            res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
        });
    }
    if (process.env.NODE_ENV !== "production") {
        app.get("/debug", (_req, res) => {
            res.json({
                servingFrom: clientDist,
                reactBuild: reactExists,
                cwd: process.cwd(),
                dirname: __dirname,
                reactDist,
                legacyDist,
                distExists: (0, fs_1.existsSync)(clientDist),
                reactDistExists: (0, fs_1.existsSync)(reactDist),
                legacyDistExists: (0, fs_1.existsSync)(legacyDist),
            });
        });
    }
    app.use((_req, res) => {
        res.sendFile((0, path_1.resolve)(clientDist, "index.html"));
    });
}
const httpServer = (0, http_1.createServer)(app);
(0, admin_ws_js_1.initAdminWs)(httpServer);
httpServer.listen(PORT, () => {
    logger_js_1.logger.info(`Server running on http://localhost:${PORT}`);
});
function shutdown(signal) {
    logger_js_1.logger.info(`Received ${signal}, shutting down gracefully...`);
    (0, admin_ws_js_1.closeAdminWs)();
    httpServer.close(async () => {
        (0, cache_js_1.cacheClear)();
        await supabase_js_1.supabase.auth.signOut().catch(() => { });
        logger_js_1.logger.info("Server shut down");
        process.exit(0);
    });
    setTimeout(() => {
        logger_js_1.logger.error("Forced shutdown after timeout");
        process.exit(1);
    }, 10_000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    logger_js_1.logger.error("UNHANDLED REJECTION", { reason: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined });
});
process.on("uncaughtException", (err) => {
    logger_js_1.logger.error("UNCAUGHT EXCEPTION", { error: err.message, stack: err.stack });
});
// For dev: let process managers know the app is ready
logger_js_1.logger.info("App initialized");
exports.default = app;
//# sourceMappingURL=index.js.map