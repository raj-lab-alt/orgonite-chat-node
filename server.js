const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("[server.js] Starting up v2...");
const distPath = path.join(__dirname, "server", "dist", "index.js");

if (!fs.existsSync(distPath)) {
  console.log("[server.js] Compiled server not found, running build...");
  try {
    execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
  } catch {
    console.error("[FATAL] Build failed. Could not start server.");
    process.exit(1);
  }
}

try {
  require(distPath);
} catch (err) {
  console.error("[FATAL]", err?.message || err);
  process.exit(1);
}
