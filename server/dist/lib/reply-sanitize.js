"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAssistantReply = sanitizeAssistantReply;
exports.stripInternalDiagnostics = stripInternalDiagnostics;
const DIAGNOSTIC_KEYS = new Set([
    "lang",
    "mode",
    "type",
    "intent",
    "prenom",
    "besoin",
    "outil_cible",
    "prix_dit",
    "order_confirmed_flag",
    "tel",
    "tel_raw",
    "doublon",
]);
const DIAGNOSTIC_LINE_MARKER = /\[+\s*(?:ETAT|ÉTAT|LANGUE|DEBUG|DIAG(?:NOSTIC)?|STATE|ANALYSE|ANALYSIS)\s*\]*|^(?:ETAT|ÉTAT|LANGUE|DEBUG|DIAG(?:NOSTIC)?|STATE|ANALYSE|ANALYSIS)\s*[:=-]/i;
const DIAGNOSTIC_KEY_PATTERN = /\{?\b(?:lang|mode|type|intent|prenom|besoin|outil_cible|prix_dit|order_confirmed_flag|tel|tel_raw|doublon)\b\}?\s*=/gi;
const SEPARATOR_LINE = /^\s*-{3,}\s*$/;
function sanitizeAssistantReply(reply) {
    let cleaned = stripInternalDiagnostics(stripDiagnosticJsonAtStart(reply));
    cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/gi, (block) => {
        const json = block.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
        return isDiagnosticJson(json) ? "" : block;
    });
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => isDiagnosticText(block) ? "" : block);
    cleaned = cleaned.replace(/---\s*INSTRUCTION STRICTE[^]*?(?=\[RENDER_PRODUCT|$)/gi, "").trim();
    return cleaned.trim();
}
function stripInternalDiagnostics(reply) {
    let text = String(reply || "")
        .replace(/<\s*(?:ETAT|LANGUE|DEBUG|DIAG(?:NOSTIC)?|STATE|ANALYSE|ANALYSIS)\s*>[\s\S]*?<\s*\/\s*(?:ETAT|LANGUE|DEBUG|DIAG(?:NOSTIC)?|STATE|ANALYSE|ANALYSIS)\s*>/gi, "\n")
        .replace(/(?:^|\n)\s*\[+\s*(?:ETAT|ÉTAT|LANGUE|DEBUG|DIAG(?:NOSTIC)?|STATE|ANALYSE|ANALYSIS)\s*\]?[^\n]*/gi, "\n")
        .replace(/^\s*-{3,}\s*(?:\r?\n)?/, "");
    const lines = text.split(/\r?\n/);
    let removedDiagnostic = false;
    const kept = [];
    for (const line of lines) {
        if (isDiagnosticLine(line)) {
            removedDiagnostic = true;
            continue;
        }
        if (removedDiagnostic && SEPARATOR_LINE.test(line)) {
            continue;
        }
        kept.push(line);
    }
    return kept.join("\n").trimStart();
}
function stripDiagnosticJsonAtStart(reply) {
    let text = reply.trimStart();
    while (text.startsWith("{")) {
        const end = findMatchingObjectEnd(text);
        if (end < 0)
            return text;
        const candidate = text.slice(0, end + 1);
        if (!isDiagnosticJson(candidate))
            return text;
        text = text.slice(end + 1).trimStart();
    }
    return text;
}
function findMatchingObjectEnd(text) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (char === "\\") {
                escaped = true;
            }
            else if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
        }
        else if (char === "{") {
            depth++;
        }
        else if (char === "}") {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
function isDiagnosticJson(value) {
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return false;
        const keys = Object.keys(parsed);
        const diagnosticKeyCount = keys.filter((key) => DIAGNOSTIC_KEYS.has(key)).length;
        return diagnosticKeyCount >= 3;
    }
    catch {
        return false;
    }
}
function isDiagnosticLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return false;
    if (DIAGNOSTIC_LINE_MARKER.test(trimmed))
        return true;
    const matches = trimmed.match(DIAGNOSTIC_KEY_PATTERN);
    DIAGNOSTIC_KEY_PATTERN.lastIndex = 0;
    return Boolean(matches && matches.length >= 2);
}
function isDiagnosticText(value) {
    const matches = value.match(DIAGNOSTIC_KEY_PATTERN);
    DIAGNOSTIC_KEY_PATTERN.lastIndex = 0;
    return DIAGNOSTIC_LINE_MARKER.test(value) || Boolean(matches && matches.length >= 3);
}
//# sourceMappingURL=reply-sanitize.js.map