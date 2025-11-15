#!/usr/bin/env node
/**
 * Firebase Authentication Users Restore Script
 * 
 * This script restores Firebase Authentication users from a backup JSON file.
 * It imports users back into Firebase Authentication (emulator or production).
 * 
 * Usage:
 *   npx tsx scripts/restore-firebase-auth.ts <backup-file-path>
 * 
 * Example:
 *   npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json
 * 
 * The script will:
 * 1. Load users from the backup JSON file
 * 2. Initialize Firebase Admin SDK
 * 3. Import users back into Firebase Authentication
 * 4. Preserve user metadata, custom claims, and provider data
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface UserBackup {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  disabled: boolean;
  metadata: {
    creationTime?: string;
    lastSignInTime?: string;
    lastRefreshTime?: string;
  };
  customClaims?: Record<string, unknown>;
  providerData: Array<{
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    providerId: string;
    phoneNumber?: string;
  }>;
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): void {
  if (admin.apps.length === 0) {
    // Check if running with emulators (no credentials needed!)
    const useEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
    
    if (useEmulator) {
      // Initialize for emulator - NO CREDENTIALS NEEDED!
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai';
      
      // Set emulator environment variables if not already set
      if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
      }
      
      admin.initializeApp({
        projectId: projectId,
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Auth Emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
    } else {
      // Initialize with default credentials (for production)
      try {
        admin.initializeApp();
        const projectId = admin.app().options.projectId || 'unknown-project';
        console.log('✅ Firebase Admin SDK initialized (Production mode)');
        console.log(`   Project ID: ${projectId}`);
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK');
        console.error('\n💡 Setup Instructions:');
        console.error('   For PRODUCTION restore:');
        console.error('   1. Set GOOGLE_APPLICATION_CREDENTIALS');
        console.error('   2. Or use Application Default Credentials: gcloud auth application-default login');
        console.error('\n   For EMULATOR restore (no credentials needed!):');
        console.error('   1. Start Firebase emulators: firebase emulators:start');
        console.error('   2. Set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 in .env.local');
        throw error;
      }
    }
  }
}

/**
 * Convert user backup to Firebase Admin SDK user import format
 */
function convertToUserImportRecord(user: UserBackup): admin.auth.UserImportRecord {
  const record: admin.auth.UserImportRecord = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoURL: user.photoURL,
    phoneNumber: user.phoneNumber,
    disabled: user.disabled,
    metadata: {
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      lastRefreshTime: user.metadata.lastRefreshTime,
    },
    customClaims: user.customClaims,
    providerData: user.providerData.map(provider => ({
      uid: provider.uid,
      email: provider.email,
      displayName: provider.displayName,
      photoURL: provider.photoURL,
      providerId: provider.providerId,
      phoneNumber: provider.phoneNumber,
    })),
  };

  return record;
}

/**
 * Restore users from backup file
 */
async function restoreAuthUsers(backupFilePath: string, dryRun: boolean = false): Promise<void> {
  try {
    // Check if backup file exists
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }

    // Initialize Firebase
    initializeFirebase();

    // Load users from backup file
    console.log(`📂 Loading users from: ${backupFilePath}`);
    const backupContent = fs.readFileSync(backupFilePath, 'utf-8');
    const users: UserBackup[] = JSON.parse(backupContent);

    if (!Array.isArray(users)) {
      throw new Error('Backup file must contain an array of users');
    }

    console.log(`📋 Found ${users.length} users in backup`);

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email || user.uid} (${user.disabled ? 'disabled' : 'enabled'})`);
      });
      console.log(`\n✅ Would restore ${users.length} users`);
      return;
    }

    const auth = admin.auth();
    let totalImported = 0;
    let totalErrors = 0;

    // Check if we're using emulators (password hashes not needed)
    const useEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
    
    if (useEmulator) {
      // For emulators, use createUser (doesn't require password hashes)
      console.log('\n🔄 Restoring users (Emulator mode - using createUser)...\n');
      
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          console.log(`   ${i + 1}/${users.length}. Creating user: ${user.email || user.uid}...`);
          
          // Create user with basic properties
          const createRequest: admin.auth.CreateRequest = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName && user.displayName.trim() ? user.displayName : undefined,
            photoURL: user.photoURL && user.photoURL.trim() ? user.photoURL : undefined,
            phoneNumber: user.phoneNumber && user.phoneNumber.trim() ? user.phoneNumber : undefined,
            disabled: user.disabled,
          };

          await auth.createUser(createRequest);
          totalImported++;
          console.log(`      ✅ Created user: ${user.email || user.uid}`);
        } catch (error: any) {
          // Check if user already exists
          if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
            console.log(`      ⚠️  User already exists, updating: ${user.email || user.uid}`);
            try {
              // Update existing user
              await auth.updateUser(user.uid, {
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName && user.displayName.trim() ? user.displayName : undefined,
                photoURL: user.photoURL && user.photoURL.trim() ? user.photoURL : undefined,
                phoneNumber: user.phoneNumber && user.phoneNumber.trim() ? user.phoneNumber : undefined,
                disabled: user.disabled,
              });
              totalImported++;
              console.log(`      ✅ Updated user: ${user.email || user.uid}`);
            } catch (updateError) {
              console.error(`      ❌ Failed to update user: ${updateError}`);
              totalErrors++;
            }
          } else {
            console.error(`      ❌ Error creating user: ${error.message}`);
            totalErrors++;
          }
        }
      }
    } else {
      // For production, try importUsers (requires password hashes)
      console.log('\n🔄 Importing users (Production mode - requires password hashes)...\n');
      console.log('   ⚠️  Note: Password hashes are not available in backups.');
      console.log('   ⚠️  Users will need to reset passwords after restore.\n');
      
      // Convert to import format
      const importRecords = users.map(convertToUserImportRecord);

      // Import users in batches (Firebase allows up to 1000 users per batch)
      const batchSize = 1000;
      
      for (let i = 0; i < importRecords.length; i += batchSize) {
        const batch = importRecords.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(importRecords.length / batchSize);

        try {
          console.log(`   Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)...`);
          
          // Try importUsers without hash (may fail, but worth trying)
          const result = await auth.importUsers(batch);

          totalImported += result.successCount;
          totalErrors += result.failureCount;

          if (result.errors.length > 0) {
            console.log(`   ⚠️  ${result.errors.length} errors in this batch:`);
            result.errors.forEach((error, idx) => {
              console.log(`      ${idx + 1}. Index ${error.index}: ${error.error.message}`);
            });
          } else {
            console.log(`   ✅ Successfully imported ${result.successCount} users`);
          }
        } catch (error) {
          console.error(`   ❌ Error importing batch ${batchNumber}:`, error);
          console.error(`   💡 Try using createUser instead for emulators or provide password hashes`);
          throw error;
        }
      }
    }

    // Set custom claims for users that have them
    console.log('\n🔐 Setting custom claims...\n');
    let claimsSet = 0;
    for (const user of users) {
      if (user.customClaims && Object.keys(user.customClaims).length > 0) {
        try {
          await auth.setCustomUserClaims(user.uid, user.customClaims);
          claimsSet++;
        } catch (error) {
          console.error(`   ⚠️  Failed to set custom claims for ${user.uid}:`, error);
        }
      }
    }

    console.log(`\n✅ Restore completed successfully!`);
    console.log(`   👥 Total users imported: ${totalImported}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   🔐 Custom claims set: ${claimsSet}`);
    
    if (totalErrors > 0) {
      console.log(`\n⚠️  Note: Some users failed to import. Check the errors above.`);
    }

    console.log(`\n💡 Important Notes:`);
    console.log(`   - Password hashes are not included in backups`);
    console.log(`   - Users will need to reset passwords or use passwordless auth`);
    console.log(`   - Email verification status has been restored`);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run restore if script is executed directly
if (require.main === module) {
  const backupFilePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

  if (!backupFilePath) {
    console.error('❌ Error: Backup file path is required');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/restore-firebase-auth.ts <backup-file-path> [--dry-run]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json');
    console.error('  npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json --dry-run');
    process.exit(1);
  }

  restoreAuthUsers(backupFilePath, dryRun)
    .then(() => {
      console.log('\n✨ Restore process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { restoreAuthUsers };

