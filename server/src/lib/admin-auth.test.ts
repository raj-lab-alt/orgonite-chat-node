import { describe, it, expect, beforeEach } from "vitest";
import { isAdminToken, verifyAdminPassword } from "./admin-auth.js";

describe("isAdminToken", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "testpass";
    process.env.ADMIN_TOKEN_SALT = "testsalt";
  });

  it("returns true for valid token", () => {
    const token = "519c6f06399f2549568a588277297d43"; // sha256("testpass:testsalt").slice(0,32)
    expect(isAdminToken(token)).toBe(true);
  });

  it("returns false for invalid token", () => {
    expect(isAdminToken("invalidtoken12345678901234567890")).toBe(false);
  });

  it("returns false for wrong-length token", () => {
    expect(isAdminToken("short")).toBe(false);
  });

  it("returns false when no password configured", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV = "production";
    expect(isAdminToken("anything")).toBe(false);
  });
});

describe("verifyAdminPassword", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "testpass";
    process.env.ADMIN_TOKEN_SALT = "testsalt";
  });

  it("returns true for correct password", () => {
    expect(verifyAdminPassword("testpass")).toBe(true);
  });

  it("returns false for wrong password", () => {
    expect(verifyAdminPassword("wrongpass")).toBe(false);
  });

  it("returns false when no password configured", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV = "production";
    expect(verifyAdminPassword("anything")).toBe(false);
  });
});
