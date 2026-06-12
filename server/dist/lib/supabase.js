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
dotenv_1.default.config({ path: (0, path_1.resolve)(__dirname, "../../../.env") });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables");
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl || "", supabaseServiceKey || "", {
    realtime: {
        transport: ws_1.default,
    },
});
//# sourceMappingURL=supabase.js.map