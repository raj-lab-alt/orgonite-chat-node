"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const logger_js_1 = require("./logger.js");
dotenv_1.default.config({ path: (0, path_1.resolve)(__dirname, "../../../.env") });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceKey);
if (!hasSupabaseConfig) {
    logger_js_1.logger.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables");
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl || "http://127.0.0.1:54321", supabaseServiceKey || "missing-supabase-service-key", {
    realtime: {
        transport: ws_1.default,
    },
});
//# sourceMappingURL=supabase.js.map