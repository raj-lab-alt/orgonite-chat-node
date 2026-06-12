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
const chat_js_1 = require("./routes/chat.js");
const orders_js_1 = require("./routes/orders.js");
const products_js_1 = require("./routes/products.js");
const services_js_1 = require("./routes/services.js");
const admin_js_1 = require("./routes/admin.js");
const tracking_js_1 = require("./routes/tracking.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express_1.default.json({ limit: "20mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "20mb" }));
app.use("/api/chat", chat_js_1.chatRouter);
app.use("/api/orders", orders_js_1.ordersRouter);
app.use("/api/products", products_js_1.productsRouter);
app.use("/api/services", services_js_1.servicesRouter);
app.use("/api/admin", admin_js_1.adminRouter);
app.use("/api", tracking_js_1.trackingRouter);
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use((err, _req, res, _next) => {
    console.error("[ERROR]", err instanceof Error ? err.message : err);
    if (err instanceof Error)
        console.error(err.stack);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV !== "production" ? (err instanceof Error ? err.message : String(err)) : undefined,
    });
});
// Serve React app in production
const clientDist = (0, path_1.resolve)(__dirname, "../../client/dist");
if ((0, fs_1.existsSync)(clientDist)) {
    app.use(express_1.default.static(clientDist));
    app.use((_req, res) => {
        res.sendFile((0, path_1.resolve)(clientDist, "index.html"));
    });
}
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map