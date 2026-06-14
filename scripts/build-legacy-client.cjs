const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// Build the React app with Vite (outputs to client/dist/)
execSync("npm --prefix client run build", { cwd: root, stdio: "inherit" });

// Copy extra static assets from legacy that are not produced by Vite
const legacyDir = path.join(root, "client", "legacy");
const distDir = path.join(root, "client", "dist");

const extraFiles = ["robots.txt", "amine-avatar.webp"];
for (const file of extraFiles) {
  const src = path.join(legacyDir, file);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(distDir, file));
  }
}
