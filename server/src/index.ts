import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { chatRouter } from "./routes/chat.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { adminRouter } from "./routes/admin.js";
import { trackingRouter } from "./routes/tracking.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "20mb" }));

app.use("/api/chat", chatRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/products", productsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", trackingRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
