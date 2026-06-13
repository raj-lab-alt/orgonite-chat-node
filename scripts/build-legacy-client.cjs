const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "client", "legacy");
const target = path.join(root, "client", "dist");

if (!fs.existsSync(source)) {
  throw new Error(`Legacy client source not found: ${source}`);
}

if (!fs.existsSync(target)) {
  fs.mkdirSync(target, { recursive: true });
}

const entries = fs.readdirSync(source, { withFileTypes: true });
for (const entry of entries) {
  if (entry.name === "index.html") continue;
  const srcPath = path.join(source, entry.name);
  const dstPath = path.join(target, entry.name);
  if (entry.isDirectory()) {
    fs.cpSync(srcPath, dstPath, { recursive: true });
  } else {
    fs.cpSync(srcPath, dstPath);
  }
}
