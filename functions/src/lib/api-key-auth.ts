import * as crypto from "crypto";
import { Request } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * SHA-256 hash of a raw API key for safe storage and lookup.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Authenticates the incoming request using one of two strategies:
 *
 *  1. API key  — X-API-Key header, or Authorization: Bearer ciai_<key>
 *                Validated against the `apiKeys` Firestore collection.
 *
 *  2. Firebase ID token — Authorization: Bearer eyJ...
 *                Verified by the Firebase Admin SDK. Useful for testing
 *                and for first-party clients that already hold a user token.
 *
 * Returns the authenticated userId on success. Throws on failure.
 */
export async function validateApiKeyFromRequest(req: Request): Promise<string> {
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
  if (token.startsWith("ciai_")) {
    return validateStoredApiKey(token);
  }

  // --- Path 3: Firebase ID token in Bearer ---
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new Error("Invalid or expired Firebase ID token.");
  }
}

async function validateStoredApiKey(rawKey: string): Promise<string> {
  const keyHash = hashApiKey(rawKey);
  const db = getFirestore();

  const snap = await db
    .collection("apiKeys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error("Invalid or revoked API key.");
  }

  const doc = snap.docs[0];

  // Update lastUsedAt in the background — don't block the request
  doc.ref.update({ lastUsedAt: new Date() }).catch((e) => {
    console.warn("Failed to update lastUsedAt for API key:", e);
  });

  return doc.data().userId as string;
}
