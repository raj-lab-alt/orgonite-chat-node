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

export function sanitizeAssistantReply(reply: string): string {
  let cleaned = stripDiagnosticJsonAtStart(reply);
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/gi, (block) => {
    const json = block.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    return isDiagnosticJson(json) ? "" : block;
  });
  cleaned = cleaned.replace(/---\s*INSTRUCTION STRICTE[^]*?(?=\[RENDER_PRODUCT|$)/gi, "").trim();
  return cleaned.trim();
}

function stripDiagnosticJsonAtStart(reply: string): string {
  let text = reply.trimStart();

  while (text.startsWith("{")) {
    const end = findMatchingObjectEnd(text);
    if (end < 0) return text;

    const candidate = text.slice(0, end + 1);
    if (!isDiagnosticJson(candidate)) return text;

    text = text.slice(end + 1).trimStart();
  }

  return text;
}

function findMatchingObjectEnd(text: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function isDiagnosticJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;

    const keys = Object.keys(parsed);
    const diagnosticKeyCount = keys.filter((key) => DIAGNOSTIC_KEYS.has(key)).length;
    return diagnosticKeyCount >= 3;
  } catch {
    return false;
  }
}
