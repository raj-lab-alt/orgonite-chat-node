import { createHash, timingSafeEqual } from "crypto";

export function adminPassword() {
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (configuredPassword) return configuredPassword;
  return process.env.NODE_ENV === "production" ? "" : "amine123";
}

export function adminToken() {
  const password = adminPassword();
  if (!password) return "";

  const salt = process.env.ADMIN_TOKEN_SALT || "orgonite-node-admin";
  return createHash("sha256")
    .update(`${password}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}

export function isAdminToken(token: string) {
  const expected = adminToken();
  if (!expected || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function verifyAdminPassword(password: string) {
  const configured = adminPassword();
  if (!configured) return false;
  const hash = (pw: string) => createHash("sha256").update(pw).digest();
  return timingSafeEqual(hash(password), hash(configured));
}

export function isSupabaseAdminUser(user: any) {
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  if (role === "admin") return true;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user?.email && adminEmails.includes(String(user.email).toLowerCase()));
}
