import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

const DEFAULT_DEV_KEY = "nexus-admin";

/**
 * Validates admin credentials across x-admin-key header, Authorization: Bearer <token>,
 * or URL search params (?key=...).
 *
 * Security properties:
 * 1. Production fail-closed: If ADMIN_SECRET or ADMIN_KEY is not configured in production,
 *    all admin requests are denied immediately (no insecure fallback).
 * 2. Constant-time comparison: SHA-256 digests are compared via timingSafeEqual to prevent
 *    timing side-channel attacks.
 * 3. Header-first authentication: Headers are prioritized over URL parameters to prevent
 *    token leakage in browser history, logs, or referer headers.
 */
export function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_KEY;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === "production") {
    console.error("[SECURITY ALERT] ADMIN_SECRET/ADMIN_KEY environment variable is not configured in production. Failing closed.");
    return null;
  }

  return DEFAULT_DEV_KEY;
}

export function extractProvidedAdminKey(req: NextRequest): string | null {
  // 1. Check x-admin-key header
  const customHeader = req.headers.get("x-admin-key");
  if (customHeader && customHeader.trim()) {
    return customHeader.trim();
  }

  // 2. Check Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }

  // 3. Fallback to query parameter ?key=
  const queryKey = req.nextUrl.searchParams.get("key");
  if (queryKey && queryKey.trim()) {
    return queryKey.trim();
  }

  return null;
}

export function verifyAdminAuth(req: NextRequest): { ok: boolean; error?: string } {
  const expectedSecret = getAdminSecret();
  if (!expectedSecret) {
    return { ok: false, error: "Admin authentication is disabled due to missing configuration" };
  }

  const provided = extractProvidedAdminKey(req);
  if (!provided) {
    return { ok: false, error: "Missing admin authorization credentials" };
  }

  try {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expectedSecret).digest();
    const matches = timingSafeEqual(a, b);
    if (!matches) {
      return { ok: false, error: "ACCESS DENIED — invalid admin credentials" };
    }
    return { ok: true };
  } catch (err) {
    console.error("Admin auth verification error:", err);
    return { ok: false, error: "Authentication system error" };
  }
}

/**
 * Safely masks email for admin listings and logs to protect PII.
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 1);
  const maskedLength = Math.max(2, Math.min(6, user.length - 1));
  return `${visible}${"*".repeat(maskedLength)}@${domain}`;
}
