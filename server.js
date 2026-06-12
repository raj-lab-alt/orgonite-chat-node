try {
  require("./server/dist/index.js");
} catch (err) {
  console.error("[FATAL]", err?.message || err);
  process.exit(1);
}
