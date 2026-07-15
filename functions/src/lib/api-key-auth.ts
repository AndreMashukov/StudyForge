import * as crypto from "crypto";
import { Request } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const API_KEY_BEARER_PREFIX = "sf-";
export const LAST_USED_AT_UPDATE_INTERVAL_MS = 60_000;

export interface ExternalAuthResult {
  userId: string;
  authMethod: "api-key" | "firebase-id-token";
  limiterKey: string;
  apiKeyId?: string;
}

/**
 * SHA-256 hash of a raw API key for safe storage and lookup.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function hasToDate(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  );
}

export function isLastUsedAtUpdateDue(
  lastUsedAt: unknown,
  nowMs: number = Date.now()
): boolean {
  if (!lastUsedAt) {
    return true;
  }

  let lastUsedMs: number | null = null;
  if (hasToDate(lastUsedAt)) {
    lastUsedMs = lastUsedAt.toDate().getTime();
  } else if (lastUsedAt instanceof Date) {
    lastUsedMs = lastUsedAt.getTime();
  }

  if (lastUsedMs === null) {
    return true;
  }

  return nowMs - lastUsedMs >= LAST_USED_AT_UPDATE_INTERVAL_MS;
}

/**
 * Authenticates the incoming request using one of two strategies:
 *
 *  1. API key  — X-API-Key header, or Authorization: Bearer sf-<key>
 *                Validated against users/{userId}/apiKeys.
 *
 *  2. Firebase ID token — Authorization: Bearer eyJ...
 *                Verified by the Firebase Admin SDK. Useful for testing
 *                and for first-party clients that already hold a user token.
 *
 * Returns the authenticated userId on success. Throws on failure.
 */
export async function validateApiKeyFromRequest(req: Request): Promise<string> {
  const auth = await validateExternalAuthFromRequest(req);
  return auth.userId;
}

export async function validateExternalAuthFromRequest(req: Request): Promise<ExternalAuthResult> {
  const apiKeyHeader = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];

  // --- Path 1: explicit X-API-Key header ---
  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    return validateStoredApiKey(apiKeyHeader.trim());
  }

  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    throw new Error(
      "Missing credentials. Provide X-API-Key header or Authorization: Bearer <token>."
    );
  }

  const token = authHeader.slice(7).trim();

  // --- Path 2: API key in Bearer (starts with our prefix) ---
  if (token.startsWith(API_KEY_BEARER_PREFIX)) {
    return validateStoredApiKey(token);
  }

  // --- Path 3: Firebase ID token in Bearer ---
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return {
      userId: decoded.uid,
      authMethod: "firebase-id-token",
      limiterKey: `firebase_${decoded.uid}`,
    };
  } catch {
    throw new Error("Invalid or expired Firebase ID token.");
  }
}

async function validateStoredApiKey(rawKey: string): Promise<ExternalAuthResult> {
  const keyHash = hashApiKey(rawKey);
  const db = getFirestore();

  const snap = await db
    .collectionGroup("apiKeys")
    .where("keyHash", "==", keyHash)
    .limit(1)
    .get();

  const doc = snap.docs[0];
  const data = doc?.data();

  if (!data?.active) {
    throw new Error("Invalid or revoked API key.");
  }

  if (isLastUsedAtUpdateDue(data.lastUsedAt)) {
    doc.ref.update({ lastUsedAt: new Date() }).catch((e) => {
      console.warn("Failed to update lastUsedAt for API key:", e);
    });
  }

  const userId = doc.ref.parent.parent?.id;
  if (!userId) {
    throw new Error("Invalid API key owner.");
  }

  return {
    userId,
    authMethod: "api-key",
    apiKeyId: doc.id,
    limiterKey: doc.id,
  };
}
