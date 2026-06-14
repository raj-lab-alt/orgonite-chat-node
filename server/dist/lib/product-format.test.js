"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const product_format_js_1 = require("./product-format.js");
(0, vitest_1.describe)("formatProduct", () => {
    (0, vitest_1.it)("formats a basic product", () => {
        const row = { id: "p1", name: "Coeur Vert", slug: "coeur-vert", price: "25.00", image_url: "img.jpg" };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.id).toBe("p1");
        (0, vitest_1.expect)(p.name).toBe("Coeur Vert");
        (0, vitest_1.expect)(p.price).toBe(25);
        (0, vitest_1.expect)(p.currency).toBe("DT");
    });
    (0, vitest_1.it)("handles null price", () => {
        const row = { id: "p1", name: "Test", price: null };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.price).toBe(0);
    });
    (0, vitest_1.it)("handles camelCase fields", () => {
        const row = { id: "p2", name: "Test", accentColor: "#ff0000", productType: "protection" };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.accentColor).toBe("#ff0000");
        (0, vitest_1.expect)(p.productType).toBe("protection");
    });
    (0, vitest_1.it)("handles snake_case fields", () => {
        const row = { id: "p3", name: "Test", accent_color: "#00ff00", product_type: "spiritual" };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.accentColor).toBe("#00ff00");
        (0, vitest_1.expect)(p.productType).toBe("spiritual");
    });
    (0, vitest_1.it)("parses welcome_sequence JSON", () => {
        const row = { id: "p4", name: "Test", welcome_sequence: '["msg1","msg2"]' };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.welcomeSequence).toEqual(["msg1", "msg2"]);
    });
    (0, vitest_1.it)("handles empty faq", () => {
        const row = { id: "p5", name: "Test", faq: null };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.faq).toEqual([]);
    });
    (0, vitest_1.it)("sets visible default to true", () => {
        const row = { id: "p1", name: "Test" };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.visible).toBe(true);
    });
    (0, vitest_1.it)("respects visible=false", () => {
        const row = { id: "p1", name: "Test", visible: false };
        const p = (0, product_format_js_1.formatProduct)(row);
        (0, vitest_1.expect)(p.visible).toBe(false);
    });
});
//# sourceMappingURL=product-format.test.js.map