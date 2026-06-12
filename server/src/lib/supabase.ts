import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
  );
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseServiceKey || "",
  {
    realtime: {
      transport: WebSocket as any,
    },
  }
);
