"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const supabase_js_1 = require("../lib/supabase.js");
const admin_auth_js_1 = require("../lib/admin-auth.js");
async function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Non autorise" });
    }
    const token = auth.slice(7);
    if ((0, admin_auth_js_1.isAdminToken)(token)) {
        req.user = { role: "admin" };
        return next();
    }
    const { data: { user }, error, } = await supabase_js_1.supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: "Non autorise" });
    }
    if (!(0, admin_auth_js_1.isSupabaseAdminUser)(user)) {
        return res.status(403).json({ error: "Acces admin refuse" });
    }
    req.user = user;
    next();
}
//# sourceMappingURL=auth.js.map