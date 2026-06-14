import { describe, it, expect } from "vitest";
import { sanitizeAssistantReply } from "./reply-sanitize.js";

describe("sanitizeAssistantReply", () => {
  it("preserves normal text", () => {
    expect(sanitizeAssistantReply("Bonjour !")).toBe("Bonjour !");
  });

  it("strips diagnostic JSON at start", () => {
    const reply = `{"lang":"fr","mode":"vente","type":"hello"}\nBonjour !`;
    expect(sanitizeAssistantReply(reply)).toBe("Bonjour !");
  });

  it("preserves text without diagnostic JSON", () => {
    const reply = `{"name":"Pierre","age":30}\nBonjour !`;
    expect(sanitizeAssistantReply(reply)).toBe('{"name":"Pierre","age":30}\nBonjour !');
  });

  it("strips diagnostic JSON in code blocks", () => {
    const reply = "Voici\n```json\n{\"lang\":\"fr\",\"mode\":\"vente\",\"type\":\"hello\"}\n```\nSuite";
    expect(sanitizeAssistantReply(reply)).toBe("Voici\n\nSuite");
  });

  it("removes strict instruction blocks and everything after", () => {
    const reply = "Avant\n---\nINSTRUCTION STRICTE: ne pas repondre\nSuite";
    expect(sanitizeAssistantReply(reply)).toBe("Avant");
  });

  it("handles empty string", () => {
    expect(sanitizeAssistantReply("")).toBe("");
  });

  it("strips multiple diagnostic JSON blocks", () => {
    const reply = `{"lang":"fr","mode":"vente","type":"hello"}\n{"lang":"en","mode":"info","type":"question"}\nBonjour`;
    expect(sanitizeAssistantReply(reply)).toBe("Bonjour");
  });

  it("strips state diagnostic blocks", () => {
    const reply = `[[ETAT] {lang}=fr | {mode}=A | {type}=protection | {intent}=decouverte\n-----\nBonjour`;
    expect(sanitizeAssistantReply(reply)).toBe("Bonjour");
  });
});
