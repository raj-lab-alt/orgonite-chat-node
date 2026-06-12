import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(__dirname, "server/dist/index.js");

if (!existsSync(serverEntry)) {
  console.error("Server build not found. Run 'npm run build' first.");
  process.exit(1);
}

console.log("Starting Orgonite Chat Node...");
await import(serverEntry);
