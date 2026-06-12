import { createHash } from "crypto";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "amine123";
}

export function adminToken() {
  const salt = process.env.ADMIN_TOKEN_SALT || "orgonite-node-admin";
  return createHash("sha256")
    .update(`${adminPassword()}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}

export function isAdminToken(token: string) {
  return token === adminToken();
}
