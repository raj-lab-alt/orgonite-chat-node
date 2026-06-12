import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const ordersRouter = Router();

ordersRouter.get("/", async (req: Request, res: Response) => {
  const includeTrash = req.query.includeTrash === "1";
  let query = supabase.from("orders").select("*");

  if (!includeTrash) {
    query = query.eq("is_trashed", false);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Order not found" });
  res.json(data);
});

ordersRouter.put("/:id/statut", async (req: Request, res: Response) => {
  const { status } = req.body;
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
