import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import { validateAuth } from "../lib/auth";
import { hashApiKey } from "../lib/api-key-auth";

const MAX_KEYS_PER_USER = 10;

/**
 * Create a new API key for the authenticated user.
 * Returns the raw key exactly once — it cannot be retrieved again.
 *
 * Request: { name: string }
 * Response: { keyId, key, name, keyPrefix, createdAt }
 */
export const createApiKey = onCall(
  { region: "asia-east1", cors: true },
  async (request) => {
    const userId = validateAuth(request);
    const name = (request.data.name as string | undefined)?.trim();

    if (!name) {
      throw new HttpsError("invalid-argument", "API key name is required.");
    }

    const db = getFirestore();

    // Enforce per-user key limit
    const existing = await db
      .collection("apiKeys")
      .where("userId", "==", userId)
      .where("active", "==", true)
      .get();

    if (existing.size >= MAX_KEYS_PER_USER) {
      throw new HttpsError(
        "resource-exhausted",
        `Maximum of ${MAX_KEYS_PER_USER} active API keys reached. Revoke an existing key first.`
      );
    }

    const rawKey = "ciai_" + crypto.randomBytes(32).toString("hex");
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12) + "...";
    const now = new Date();

    const ref = db.collection("apiKeys").doc();
    await ref.set({
      userId,
      name,
      keyHash,
      keyPrefix,
      createdAt: now,
      lastUsedAt: null,
      active: true,
    });

    return {
      keyId: ref.id,
      key: rawKey,
      name,
      keyPrefix,
      createdAt: now.toISOString(),
    };
  }
);

/**
 * List all API keys for the authenticated user (metadata only, no key hashes).
 *
 * Response: { keys: Array<{ keyId, name, keyPrefix, createdAt, lastUsedAt, active }> }
 */
export const listApiKeys = onCall(
  { region: "asia-east1", cors: true },
  async (request) => {
    const userId = validateAuth(request);
    const db = getFirestore();

    const snap = await db
      .collection("apiKeys")
      .where("userId", "==", userId)
      .get();

    const keys = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          keyId: doc.id,
          name: d.name as string,
          keyPrefix: d.keyPrefix as string,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
          lastUsedAt: d.lastUsedAt?.toDate?.()?.toISOString() ?? null,
          active: d.active as boolean,
        };
      })
      .sort((a, b) => {
        // Newest first
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });

    return { keys };
  }
);

/**
 * Revoke (deactivate) an API key owned by the authenticated user.
 *
 * Request: { keyId: string }
 * Response: { success: true }
 */
export const revokeApiKey = onCall(
  { region: "asia-east1", cors: true },
  async (request) => {
    const userId = validateAuth(request);
    const keyId = request.data.keyId as string | undefined;

    if (!keyId) {
      throw new HttpsError("invalid-argument", "keyId is required.");
    }

    const db = getFirestore();
    const ref = db.collection("apiKeys").doc(keyId);
    const doc = await ref.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new HttpsError(
        "not-found",
        "API key not found or does not belong to you."
      );
    }

    await ref.update({ active: false });

    return { success: true };
  }
);
