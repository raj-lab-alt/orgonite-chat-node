import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import dotenv from "dotenv";
import { resolve } from "path";
import { logger } from "./logger.js";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceKey);

if (!hasSupabaseConfig) {
  logger.warn(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
  );
}

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseServiceKey || "missing-supabase-service-key",
  {
    realtime: {
      transport: WebSocket as any,
    },
  }
);
