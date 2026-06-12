import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const adminRouter = Router();

adminRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ session: data.session });
});

adminRouter.get("/stats", async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [ordersRes, statsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("conversation_stats")
      .select("*")
      .gte("created_at", thirtyDaysAgo),
  ]);

  res.json({
    total_orders: ordersRes.count || 0,
    conversations: statsRes.data || [],
  });
});
