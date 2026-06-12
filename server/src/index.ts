import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import { chatRouter } from "./routes/chat.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { servicesRouter } from "./routes/services.js";
import { adminRouter } from "./routes/admin.js";
import { trackingRouter } from "./routes/tracking.js";
import { requireAdmin } from "./middleware/auth.js";

dotenv.config({ path: resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api/chat", chatRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/products", productsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/admin/products", requireAdmin, productsRouter);
app.use("/api/admin/services", requireAdmin, servicesRouter);
app.use("/api/admin", adminRouter);
app.use("/api", trackingRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err instanceof Error ? err.message : err);
  if (err instanceof Error) console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV !== "production" ? (err instanceof Error ? err.message : String(err)) : undefined,
  });
});

// Serve React app in production
const clientDist = resolve(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/admin", (_req, res) => {
    res.sendFile(resolve(clientDist, "admin.html"));
  });
  app.get("/admin/", (_req, res) => {
    res.sendFile(resolve(clientDist, "admin.html"));
  });
  app.get("/sitemap.xml", (_req, res) => {
    res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  });
  app.use((_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
