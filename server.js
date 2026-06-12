const { resolve } = require("path");
const { existsSync } = require("fs");

const serverEntry = resolve(__dirname, "server/dist/index.js");

if (!existsSync(serverEntry)) {
  console.error("ERROR: Server build not found at", serverEntry);
  process.exit(1);
}

console.log("Starting Orgonite Chat Node...");

import(serverEntry).catch((err) => {
  console.error("ERROR: Server startup failed:", err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
