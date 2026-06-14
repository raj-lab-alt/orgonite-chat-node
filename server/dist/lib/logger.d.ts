export interface LogContext {
    requestId?: string;
    method?: string;
    path?: string;
    [key: string]: unknown;
}
export declare const logger: {
    debug: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    error: (msg: string, ctx?: LogContext) => void;
    child: (defaultCtx: LogContext) => {
        debug: (msg: string, ctx?: LogContext) => void;
        info: (msg: string, ctx?: LogContext) => void;
        warn: (msg: string, ctx?: LogContext) => void;
        error: (msg: string, ctx?: LogContext) => void;
    };
};
//# sourceMappingURL=logger.d.ts.map