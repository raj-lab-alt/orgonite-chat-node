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

// Auto-restart mechanism: if .restart file appears or dist file changes, restart
(function watchdog() {
  const restartFlag = path.join(__dirname, ".restart");
  const distPathWatch = path.join(__dirname, "server", "dist", "index.js");
  let distMtime = fs.existsSync(distPathWatch) ? fs.statSync(distPathWatch).mtimeMs : 0;
  setInterval(function () {
    if (fs.existsSync(restartFlag)) {
      console.log("[watchdog] .restart flag found, restarting...");
      try { fs.unlinkSync(restartFlag); } catch (e) {}
      process.exit(1); // Use exit(1) to signal Passenger/Process Manager to auto-restart
      return;
    }
    var cur = fs.existsSync(distPathWatch) ? fs.statSync(distPathWatch).mtimeMs : 0;
    if (cur > distMtime) {
      console.log("[watchdog] dist file changed, restarting...");
      distMtime = cur;
      process.exit(1); // Use exit(1) to signal Passenger/Process Manager to auto-restart
      return;
    }
  }, 10000);
})();
