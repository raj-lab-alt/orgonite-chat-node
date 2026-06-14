const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "client", "legacy");
const target = path.join(root, "client", "dist");

if (!fs.existsSync(source)) {
  throw new Error(`Legacy client source not found: ${source}`);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
