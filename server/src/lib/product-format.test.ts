import { describe, it, expect } from "vitest";
import { formatProduct } from "./product-format.js";

describe("formatProduct", () => {
  it("formats a basic product", () => {
    const row = { id: "p1", name: "Coeur Vert", slug: "coeur-vert", price: "25.00", image_url: "img.jpg" };
    const p = formatProduct(row);
    expect(p.id).toBe("p1");
    expect(p.name).toBe("Coeur Vert");
    expect(p.price).toBe(25);
    expect(p.currency).toBe("DT");
  });

  it("handles null price", () => {
    const row = { id: "p1", name: "Test", price: null };
    const p = formatProduct(row);
    expect(p.price).toBe(0);
  });

  it("handles camelCase fields", () => {
    const row = { id: "p2", name: "Test", accentColor: "#ff0000", productType: "protection" };
    const p = formatProduct(row);
    expect(p.accentColor).toBe("#ff0000");
    expect(p.productType).toBe("protection");
  });

  it("handles snake_case fields", () => {
    const row = { id: "p3", name: "Test", accent_color: "#00ff00", product_type: "spiritual" };
    const p = formatProduct(row);
    expect(p.accentColor).toBe("#00ff00");
    expect(p.productType).toBe("spiritual");
  });

  it("parses welcome_sequence JSON", () => {
    const row = { id: "p4", name: "Test", welcome_sequence: '["msg1","msg2"]' };
    const p = formatProduct(row);
    expect(p.welcomeSequence).toEqual(["msg1", "msg2"]);
  });

  it("handles empty faq", () => {
    const row = { id: "p5", name: "Test", faq: null };
    const p = formatProduct(row);
    expect(p.faq).toEqual([]);
  });

  it("sets visible default to true", () => {
    const row = { id: "p1", name: "Test" };
    const p = formatProduct(row);
    expect(p.visible).toBe(true);
  });

  it("respects visible=false", () => {
    const row = { id: "p1", name: "Test", visible: false };
    const p = formatProduct(row);
    expect(p.visible).toBe(false);
  });
});
