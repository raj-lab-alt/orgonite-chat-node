"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPassword = adminPassword;
exports.adminToken = adminToken;
exports.isAdminToken = isAdminToken;
const crypto_1 = require("crypto");
function adminPassword() {
    return process.env.ADMIN_PASSWORD || "amine123";
}
function adminToken() {
    const salt = process.env.ADMIN_TOKEN_SALT || "orgonite-node-admin";
    return (0, crypto_1.createHash)("sha256")
        .update(`${adminPassword()}:${salt}`)
        .digest("hex")
        .slice(0, 32);
}
function isAdminToken(token) {
    return token === adminToken();
}
//# sourceMappingURL=admin-auth.js.map