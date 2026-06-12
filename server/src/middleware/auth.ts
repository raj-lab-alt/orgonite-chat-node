import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non autorise" });
  }

  const token = auth.slice(7);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Non autorise" });
  }

  (req as any).user = user;
  next();
}
