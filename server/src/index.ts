import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import { createServer } from "http";
import { v4 as uuid } from "uuid";
import { chatRouter } from "./routes/chat.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { servicesRouter } from "./routes/services.js";
import { adminRouter } from "./routes/admin.js";
import { trackingRouter } from "./routes/tracking.js";
import { requireAdmin } from "./middleware/auth.js";
import { logger } from "./lib/logger.js";
import { cacheClear } from "./lib/cache.js";
import { supabase } from "./lib/supabase.js";
import { initAdminWs, closeAdminWs } from "./lib/admin-ws.js";

dotenv.config({ path: resolve(__dirname, "../../.env") });

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "GEMINI_API_KEYS"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  logger.error(`ENV manquantes: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use((req, _res, next) => {
  (req as any).requestId = uuid();
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const rid = (req as any).requestId;
  res.on("finish", () => {
    const ms = Date.now() - start;
    const ctx = { requestId: rid, method: req.method, path: req.originalUrl, status: res.statusCode, ms };
    if (res.statusCode >= 500) logger.error("Request failed", ctx);
    else if (res.statusCode >= 400) logger.warn("Request warning", ctx);
    else logger.info("Request OK", ctx);
  });
  next();
});

app.use("/api/chat", chatRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/products", productsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/admin/products", requireAdmin, productsRouter);
app.use("/api/admin/services", requireAdmin, servicesRouter);
app.use("/api/admin", adminRouter);
app.use("/api", trackingRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route API introuvable" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error("Unhandled error", { error: msg });
  if (err instanceof Error) logger.error(err.stack || "");
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV !== "production" ? msg : undefined,
  });
});

// Prefer dist-react/ (React build), fall back to dist/ (legacy PHP)
const reactDist = resolve(__dirname, "../../client/dist-react");
const clientDist = existsSync(reactDist) ? reactDist : resolve(__dirname, "../../client/dist");
const adminHtml = resolve(clientDist, "admin.html");
const adminExists = existsSync(adminHtml);

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(["/admin", "/admin/"], (_req, res) => {
    if (adminExists) {
      res.sendFile(adminHtml);
    } else {
      res.sendFile(resolve(clientDist, "index.html"));
    }
  });
  if (adminExists) {
    app.get("/sitemap.xml", (_req, res) => {
      res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    });
  }
  app.use((_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
}

const httpServer = createServer(app);
initAdminWs(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  closeAdminWs();
  httpServer.close(async () => {
    cacheClear();
    await supabase.auth.signOut().catch(() => {});
    logger.info("Server shut down");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
