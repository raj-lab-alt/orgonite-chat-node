import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import { isAdminToken, isSupabaseAdminUser } from "../lib/admin-auth.js";

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

  if (isAdminToken(token)) {
    (req as any).user = { role: "admin" };
    return next();
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Non autorise" });
  }

  if (!isSupabaseAdminUser(user)) {
    return res.status(403).json({ error: "Acces admin refuse" });
  }

  (req as any).user = user;
  next();
}
