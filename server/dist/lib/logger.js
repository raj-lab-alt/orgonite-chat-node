"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const isProd = process.env.NODE_ENV === "production";
function formatTime() {
    return new Date().toISOString();
}
function serialize(level, message, context) {
    const base = { time: formatTime(), level, msg: message };
    if (context && Object.keys(context).length > 0) {
        return JSON.stringify({ ...base, ...context });
    }
    return JSON.stringify(base);
}
function pretty(level, message, context) {
    const prefix = `${formatTime()} [${level.toUpperCase().padEnd(5)}]`;
    const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    return `${prefix} ${message}${ctx}`;
}
function log(level, message, context) {
    if (isProd) {
        console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](serialize(level, message, context));
    }
    else {
        console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](pretty(level, message, context));
    }
}
exports.logger = {
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, ctx) => log("error", msg, ctx),
    child: (defaultCtx) => ({
        debug: (msg, ctx) => log("debug", msg, { ...defaultCtx, ...ctx }),
        info: (msg, ctx) => log("info", msg, { ...defaultCtx, ...ctx }),
        warn: (msg, ctx) => log("warn", msg, { ...defaultCtx, ...ctx }),
        error: (msg, ctx) => log("error", msg, { ...defaultCtx, ...ctx }),
    }),
};
//# sourceMappingURL=logger.js.map