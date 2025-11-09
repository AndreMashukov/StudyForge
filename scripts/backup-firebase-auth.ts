#!/usr/bin/env node
/**
 * Firebase Authentication Users Backup Script
 * 
 * This script exports all Firebase Authentication users to a JSON file.
 * It uses the Firebase Admin SDK to list all users and save them to a backup file.
 * 
 * Usage:
 *   npx tsx scripts/backup-firebase-auth.ts [output-dir]
 * 
 * The script will:
 * 1. Initialize Firebase Admin SDK
 * 2. List all users (with pagination support)
 * 3. Export user data to JSON file with timestamp
 * 4. Include user metadata, custom claims, and provider data
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface BackupMetadata {
  timestamp: string;
  totalUsers: number;
  projectId: string;
  backupVersion: string;
}

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
  passwordHash?: string; // Only if available
  passwordSalt?: string; // Only if available
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
        // No credential needed for emulators!
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Auth Emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST || 'not set'}`);
    } else {
      // Initialize with default credentials (for production)
      // Uses GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials
      try {
        admin.initializeApp();
        const projectId = admin.app().options.projectId || 'unknown-project';
        console.log('✅ Firebase Admin SDK initialized (Production mode)');
        console.log(`   Project ID: ${projectId}`);
        
        // Check if credentials are available
        const creds = admin.app().options.credential;
        if (creds) {
          console.log('   ✅ Credentials found');
        } else {
          console.log('   ⚠️  Using Application Default Credentials');
        }
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK');
        console.error('\n💡 Setup Instructions:');
        console.error('   For PRODUCTION backups:');
        console.error('   1. Set GOOGLE_APPLICATION_CREDENTIALS:');
        console.error('      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"');
        console.error('   2. Or use Application Default Credentials:');
        console.error('      gcloud auth application-default login');
        console.error('\n   For EMULATOR backups (no credentials needed!):');
        console.error('   1. Start Firebase emulators:');
        console.error('      firebase emulators:start');
        console.error('   2. Set emulator environment variables in .env.local:');
        console.error('      FIREBASE_AUTH_EMULATOR_HOST=localhost:9099');
        console.error('      FIRESTORE_EMULATOR_HOST=localhost:8080');
        console.error('      GCLOUD_PROJECT=code-insights-quiz-ai');
        throw error;
      }
    }
  }
}

/**
 * List all users with pagination support
 */
async function listAllUsers(): Promise<UserBackup[]> {
  const auth = admin.auth();
  const users: UserBackup[] = [];
  let nextPageToken: string | undefined;

  console.log('📋 Fetching users from Firebase Authentication...');

  do {
    try {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      for (const userRecord of listUsersResult.users) {
        const userBackup: UserBackup = {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: userRecord.emailVerified,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          phoneNumber: userRecord.phoneNumber,
          disabled: userRecord.disabled,
          metadata: {
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime,
            lastRefreshTime: userRecord.metadata.lastRefreshTime,
          },
          customClaims: userRecord.customClaims || undefined,
          providerData: userRecord.providerData.map((provider) => ({
            uid: provider.uid,
            email: provider.email,
            displayName: provider.displayName,
            photoURL: provider.photoURL,
            providerId: provider.providerId,
            phoneNumber: provider.phoneNumber,
          })),
        };

        // Note: passwordHash and passwordSalt are not available via Admin SDK
        // They can only be exported using firebase auth:export CLI command
        
        users.push(userBackup);
      }

      console.log(`   Fetched ${listUsersResult.users.length} users (total: ${users.length})`);
      nextPageToken = listUsersResult.pageToken;
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw error;
    }
  } while (nextPageToken);

  return users;
}

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDirectory(backupDir: string): void {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${backupDir}`);
  }
}

/**
 * Main backup function
 */
async function backupAuthUsers(outputDir?: string): Promise<void> {
  try {
    // Initialize Firebase
    initializeFirebase();

    // Get project ID
    const projectId = admin.app().options.projectId || 'unknown-project';
    console.log(`🔐 Project ID: ${projectId}`);

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];
    const backupDir = outputDir || path.join(process.cwd(), 'backups', `auth-backup-${timestamp}`);
    ensureBackupDirectory(backupDir);

    // Fetch all users
    const users = await listAllUsers();

    // Create backup metadata
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      totalUsers: users.length,
      projectId: projectId,
      backupVersion: '1.0.0',
    };

    // Save users to JSON file
    const usersFilePath = path.join(backupDir, 'users.json');
    fs.writeFileSync(
      usersFilePath,
      JSON.stringify(users, null, 2),
      'utf-8'
    );

    // Save metadata
    const metadataFilePath = path.join(backupDir, 'metadata.json');
    fs.writeFileSync(
      metadataFilePath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`   📁 Backup directory: ${backupDir}`);
    console.log(`   👥 Total users backed up: ${users.length}`);
    console.log(`   📄 Users file: ${usersFilePath}`);
    console.log(`   📄 Metadata file: ${metadataFilePath}`);

    // Print summary statistics
    const stats = {
      total: users.length,
      disabled: users.filter(u => u.disabled).length,
      emailVerified: users.filter(u => u.emailVerified).length,
      withCustomClaims: users.filter(u => u.customClaims && Object.keys(u.customClaims).length > 0).length,
    };

    console.log(`\n📊 Backup Statistics:`);
    console.log(`   Total users: ${stats.total}`);
    console.log(`   Disabled users: ${stats.disabled}`);
    console.log(`   Email verified: ${stats.emailVerified}`);
    console.log(`   With custom claims: ${stats.withCustomClaims}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  const outputDir = process.argv[2];
  backupAuthUsers(outputDir)
    .then(() => {
      console.log('\n✨ Backup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { backupAuthUsers, listAllUsers };

