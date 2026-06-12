"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const supabase_js_1 = require("../lib/supabase.js");
async function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Non autorise" });
    }
    const token = auth.slice(7);
    const { data: { user }, error, } = await supabase_js_1.supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: "Non autorise" });
    }
    req.user = user;
    next();
}
//# sourceMappingURL=auth.js.map