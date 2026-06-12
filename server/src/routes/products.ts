import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const productsRouter = Router();

productsRouter.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
