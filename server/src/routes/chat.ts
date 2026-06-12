import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

export const chatRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1),
  imageBase64: z.string().optional(),
  productId: z.string().optional(),
  conversationMode: z.enum(["A", "B", "C"]).default("A"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});

chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = chatSchema.parse(req.body);
    const { message, imageBase64, productId, conversationMode, history } = body;

    // Rate limiting (in-memory for now)
    const product = productId
      ? await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single()
      : null;

    // TODO: Gemini call with streaming
    // For now, return a placeholder
    res.json({
      reply: `Message reçu : "${message}" (mode ${conversationMode})`,
      ...(product?.data && { product: product.data }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
