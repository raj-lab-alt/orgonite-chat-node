const { execSync } = require("child_process");
const { existsSync } = require("fs");
const { resolve } = require("path");

const rootDir = __dirname;
const serverEntry = resolve(rootDir, "server/dist/index.js");

if (!existsSync(serverEntry)) {
  console.log("[server.js] Building project...");
  try {
    execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
  } catch {
    console.error("[server.js] Build failed");
    process.exit(1);
  }
  if (!existsSync(serverEntry)) {
    console.error("[server.js] Build did not produce server/dist/index.js");
    process.exit(1);
  }
}

console.log("[server.js] Starting server...");
try {
  require(serverEntry);
} catch (err) {
  console.error("[server.js] Server crashed:", err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
