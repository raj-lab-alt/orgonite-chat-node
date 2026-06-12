import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(__dirname, "server/dist/index.js");

if (!existsSync(serverEntry)) {
  console.error("ERROR: Server build not found at", serverEntry);
  console.error("Run 'npm run build' first.");
  process.exit(1);
}

console.log("Starting Orgonite Chat Node...");

import(serverEntry).catch((err) => {
  console.error("ERROR: Server startup failed:", err?.message || err);
  console.error(err?.stack || "No stack trace");
  process.exit(1);
});
