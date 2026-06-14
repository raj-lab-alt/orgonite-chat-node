"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPassword = adminPassword;
exports.adminToken = adminToken;
exports.isAdminToken = isAdminToken;
exports.isSupabaseAdminUser = isSupabaseAdminUser;
const crypto_1 = require("crypto");
function adminPassword() {
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
    if (configuredPassword)
        return configuredPassword;
    return process.env.NODE_ENV === "production" ? "" : "amine123";
}
function adminToken() {
    const password = adminPassword();
    if (!password)
        return "";
    const salt = process.env.ADMIN_TOKEN_SALT || "orgonite-node-admin";
    return (0, crypto_1.createHash)("sha256")
        .update(`${password}:${salt}`)
        .digest("hex")
        .slice(0, 32);
}
function isAdminToken(token) {
    const expected = adminToken();
    if (!expected || token.length !== expected.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(Buffer.from(token), Buffer.from(expected));
}
function isSupabaseAdminUser(user) {
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    if (role === "admin")
        return true;
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    return Boolean(user?.email && adminEmails.includes(String(user.email).toLowerCase()));
}
//# sourceMappingURL=admin-auth.js.map