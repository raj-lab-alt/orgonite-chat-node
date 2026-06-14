const isProd = process.env.NODE_ENV === "production";

export interface LogContext {
  requestId?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

function formatTime(): string {
  return new Date().toISOString();
}

function serialize(level: string, message: string, context?: LogContext): string {
  const base = { time: formatTime(), level, msg: message };
  if (context && Object.keys(context).length > 0) {
    return JSON.stringify({ ...base, ...context });
  }
  return JSON.stringify(base);
}

function pretty(level: string, message: string, context?: LogContext): string {
  const prefix = `${formatTime()} [${level.toUpperCase().padEnd(5)}]`;
  const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  return `${prefix} ${message}${ctx}`;
}

function log(level: string, message: string, context?: LogContext): void {
  if (isProd) {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](serialize(level, message, context));
  } else {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](pretty(level, message, context));
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  child: (defaultCtx: LogContext) => ({
    debug: (msg: string, ctx?: LogContext) => log("debug", msg, { ...defaultCtx, ...ctx }),
    info: (msg: string, ctx?: LogContext) => log("info", msg, { ...defaultCtx, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => log("warn", msg, { ...defaultCtx, ...ctx }),
    error: (msg: string, ctx?: LogContext) => log("error", msg, { ...defaultCtx, ...ctx }),
  }),
};
