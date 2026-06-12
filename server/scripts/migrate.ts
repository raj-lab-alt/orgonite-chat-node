import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const token = process.env.SUPABASE_MGMT_TOKEN;
const ref = process.env.SUPABASE_REF || "uulvmfwghlfkuadvkjzn";

async function main() {
  if (!token) throw new Error("Missing SUPABASE_MGMT_TOKEN env var");

  const sql = readFileSync(
    resolve(root, `supabase/migrations/${process.argv[2] || "001_initial_schema"}.sql`),
    "utf-8"
  );

  console.log("Executing migration...");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  console.log("Migration applied successfully");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
