"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const reply_sanitize_js_1 = require("./reply-sanitize.js");
(0, vitest_1.describe)("sanitizeAssistantReply", () => {
    (0, vitest_1.it)("preserves normal text", () => {
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)("Bonjour !")).toBe("Bonjour !");
    });
    (0, vitest_1.it)("strips diagnostic JSON at start", () => {
        const reply = `{"lang":"fr","mode":"vente","type":"hello"}\nBonjour !`;
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe("Bonjour !");
    });
    (0, vitest_1.it)("preserves text without diagnostic JSON", () => {
        const reply = `{"name":"Pierre","age":30}\nBonjour !`;
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe('{"name":"Pierre","age":30}\nBonjour !');
    });
    (0, vitest_1.it)("strips diagnostic JSON in code blocks", () => {
        const reply = "Voici\n```json\n{\"lang\":\"fr\",\"mode\":\"vente\",\"type\":\"hello\"}\n```\nSuite";
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe("Voici\n\nSuite");
    });
    (0, vitest_1.it)("removes strict instruction blocks and everything after", () => {
        const reply = "Avant\n---\nINSTRUCTION STRICTE: ne pas repondre\nSuite";
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe("Avant");
    });
    (0, vitest_1.it)("handles empty string", () => {
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)("")).toBe("");
    });
    (0, vitest_1.it)("strips multiple diagnostic JSON blocks", () => {
        const reply = `{"lang":"fr","mode":"vente","type":"hello"}\n{"lang":"en","mode":"info","type":"question"}\nBonjour`;
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe("Bonjour");
    });
    (0, vitest_1.it)("strips state diagnostic blocks", () => {
        const reply = `[[ETAT] {lang}=fr | {mode}=A | {type}=protection | {intent}=decouverte\n-----\nBonjour`;
        (0, vitest_1.expect)((0, reply_sanitize_js_1.sanitizeAssistantReply)(reply)).toBe("Bonjour");
    });
});
//# sourceMappingURL=reply-sanitize.test.js.map