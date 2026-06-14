"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_auth_js_1 = require("./admin-auth.js");
(0, vitest_1.describe)("isAdminToken", () => {
    (0, vitest_1.beforeEach)(() => {
        process.env.ADMIN_PASSWORD = "testpass";
        process.env.ADMIN_TOKEN_SALT = "testsalt";
    });
    (0, vitest_1.it)("returns true for valid token", () => {
        const token = "519c6f06399f2549568a588277297d43"; // sha256("testpass:testsalt").slice(0,32)
        (0, vitest_1.expect)((0, admin_auth_js_1.isAdminToken)(token)).toBe(true);
    });
    (0, vitest_1.it)("returns false for invalid token", () => {
        (0, vitest_1.expect)((0, admin_auth_js_1.isAdminToken)("invalidtoken12345678901234567890")).toBe(false);
    });
    (0, vitest_1.it)("returns false for wrong-length token", () => {
        (0, vitest_1.expect)((0, admin_auth_js_1.isAdminToken)("short")).toBe(false);
    });
    (0, vitest_1.it)("returns false when no password configured", () => {
        delete process.env.ADMIN_PASSWORD;
        process.env.NODE_ENV = "production";
        (0, vitest_1.expect)((0, admin_auth_js_1.isAdminToken)("anything")).toBe(false);
    });
});
(0, vitest_1.describe)("verifyAdminPassword", () => {
    (0, vitest_1.beforeEach)(() => {
        process.env.ADMIN_PASSWORD = "testpass";
        process.env.ADMIN_TOKEN_SALT = "testsalt";
    });
    (0, vitest_1.it)("returns true for correct password", () => {
        (0, vitest_1.expect)((0, admin_auth_js_1.verifyAdminPassword)("testpass")).toBe(true);
    });
    (0, vitest_1.it)("returns false for wrong password", () => {
        (0, vitest_1.expect)((0, admin_auth_js_1.verifyAdminPassword)("wrongpass")).toBe(false);
    });
    (0, vitest_1.it)("returns false when no password configured", () => {
        delete process.env.ADMIN_PASSWORD;
        process.env.NODE_ENV = "production";
        (0, vitest_1.expect)((0, admin_auth_js_1.verifyAdminPassword)("anything")).toBe(false);
    });
});
//# sourceMappingURL=admin-auth.test.js.map