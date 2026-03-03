#!/usr/bin/env node
/**
 * Create a user in the Firebase Auth emulator with a specific UID.
 *
 * Use case: Firestore backup contains documents for UID '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv'.
 * When test@example.com is created via signUp, it gets a random UID. This script
 * creates/imports the user with the exact UID so the E2E test can see the documents.
 *
 * Usage:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/create-specific-user.ts
 *
 * Prerequisites:
 *   - Firebase Auth emulator running at localhost:9099
 */

import * as admin from 'firebase-admin';

const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';

async function main() {
  // Connect to Auth emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai',
    });
  }

  const auth = admin.auth();
  console.log(`Auth emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

  try {
    // Check if a user with this email already exists (possibly with different UID)
    let existingByEmail: admin.auth.UserRecord | null = null;
    try {
      existingByEmail = await auth.getUserByEmail(TEST_EMAIL);
    } catch {
      // User not found by email - fine
    }

    if (existingByEmail && existingByEmail.uid !== TARGET_UID) {
      console.log(`Deleting existing user ${existingByEmail.uid} (wrong UID)…`);
      await auth.deleteUser(existingByEmail.uid);
    }

    // Check if user with target UID exists
    try {
      const existingByUid = await auth.getUser(TARGET_UID);
      console.log(`Updating existing user ${TARGET_UID}…`);
      await auth.updateUser(TARGET_UID, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        emailVerified: true,
      });
      console.log(`✅ User updated: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
      return;
    } catch {
      // User not found - create new
    }

    // Create user with specific UID
    await auth.createUser({
      uid: TARGET_UID,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });

    console.log(`✅ User created: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
  } catch (error) {
    console.error('❌ Failed:', (error as Error).message);
    process.exit(1);
  }
}

main();
