const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const clientDir = path.join(root, "client");

// 1. Legacy build -> dist/ (stable fallback).
const legacyDir = path.join(clientDir, "legacy");
const distDir = path.join(clientDir, "dist");
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(legacyDir, distDir, { recursive: true });
console.log("Legacy client copied to dist/");

// 2. React build -> dist-react/ (production, used by the server when present).
execSync("npx vite build --outDir dist-react", {
  cwd: clientDir,
  stdio: "inherit",
});
console.log("React build succeeded (dist-react/)");
