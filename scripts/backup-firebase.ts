#!/usr/bin/env node
/**
 * Complete Firebase Backup Script
 * 
 * This script orchestrates the backup of both Firebase Authentication users
 * and Firestore database data. It creates a comprehensive backup with
 * timestamped directories and metadata.
 * 
 * Usage:
 *   npx tsx scripts/backup-firebase.ts [output-dir]
 * 
 * The script will:
 * 1. Backup Firebase Authentication users
 * 2. Backup Firestore database
 * 3. Create a combined backup report
 * 4. Save everything to timestamped directories
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { backupAuthUsers } from './backup-firebase-auth';
import { backupFirestore } from './backup-firestore';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface CompleteBackupMetadata {
  timestamp: string;
  projectId: string;
  backupVersion: string;
  authBackup: {
    directory: string;
    totalUsers: number;
  };
  firestoreBackup: {
    directory: string;
    totalCollections: number;
    totalDocuments: number;
  };
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
      if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      }
      
      admin.initializeApp({
        projectId: projectId,
        // No credential needed for emulators!
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Auth Emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
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
 * Read metadata from backup directory
 */
function readMetadata(backupDir: string): Record<string, unknown> | null {
  const metadataPath = path.join(backupDir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * Main backup function
 */
async function backupFirebase(outputDir?: string): Promise<void> {
  try {
    console.log('🚀 Starting complete Firebase backup...\n');

    // Initialize Firebase
    initializeFirebase();

    const projectId = admin.app().options.projectId || 'unknown-project';
    console.log(`🔐 Project ID: ${projectId}\n`);

    // Create main backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];
    const mainBackupDir = outputDir || path.join(process.cwd(), 'backups', `firebase-backup-${timestamp}`);
    
    if (!fs.existsSync(mainBackupDir)) {
      fs.mkdirSync(mainBackupDir, { recursive: true });
    }

    console.log(`📁 Main backup directory: ${mainBackupDir}\n`);

    // Step 1: Backup Authentication users
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 1: Backing up Firebase Authentication users');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const authBackupDir = path.join(mainBackupDir, 'auth');
    await backupAuthUsers(authBackupDir);
    
    const authMetadata = readMetadata(authBackupDir);
    const authTotalUsers = (authMetadata?.totalUsers as number) || 0;

    console.log('\n');

    // Step 2: Backup Firestore database
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 2: Backing up Firestore database');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const firestoreBackupDir = path.join(mainBackupDir, 'firestore');
    await backupFirestore(firestoreBackupDir);
    
    const firestoreMetadata = readMetadata(firestoreBackupDir);
    const firestoreTotalCollections = (firestoreMetadata?.collections?.length as number) || 0;
    const firestoreTotalDocuments = (firestoreMetadata?.totalDocuments as number) || 0;

    // Step 3: Create combined backup report
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 3: Creating backup report');
    console.log('═══════════════════════════════════════════════════════\n');

    const completeMetadata: CompleteBackupMetadata = {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      backupVersion: '1.0.0',
      authBackup: {
        directory: authBackupDir,
        totalUsers: authTotalUsers,
      },
      firestoreBackup: {
        directory: firestoreBackupDir,
        totalCollections: firestoreTotalCollections,
        totalDocuments: firestoreTotalDocuments,
      },
    };

    const reportPath = path.join(mainBackupDir, 'backup-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(completeMetadata, null, 2),
      'utf-8'
    );

    // Print final summary
    console.log('✅ Complete backup finished successfully!\n');
    console.log('📊 Backup Summary:');
    console.log(`   📁 Backup directory: ${mainBackupDir}`);
    console.log(`   👥 Authentication users: ${authTotalUsers}`);
    console.log(`   📚 Firestore collections: ${firestoreTotalCollections}`);
    console.log(`   📄 Firestore documents: ${firestoreTotalDocuments}`);
    console.log(`   📄 Backup report: ${reportPath}`);
    console.log('\n💡 Tip: Store this backup in a safe location!');

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  const outputDir = process.argv[2];
  backupFirebase(outputDir)
    .then(() => {
      console.log('\n✨ Complete backup process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { backupFirebase };

