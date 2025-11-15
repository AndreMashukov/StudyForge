#!/usr/bin/env node
/**
 * Complete Firebase Restore Script
 * 
 * This script orchestrates the restoration of both Firebase Authentication users
 * and Firestore database data from a complete backup.
 * 
 * Usage:
 *   npx tsx scripts/restore-firebase.ts <backup-directory-path>
 * 
 * Example:
 *   npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00
 * 
 * The script will:
 * 1. Restore Firebase Authentication users
 * 2. Restore Firestore database
 * 3. Restore Firebase Security Rules
 * 4. Create a restore report
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { restoreAuthUsers } from './restore-firebase-auth';
import { restoreFirestore } from './restore-firestore';
import { restoreFirebaseRules } from './restore-firebase-rules';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface RestoreReport {
  timestamp: string;
  backupDirectory: string;
  authRestore: {
    usersFile: string;
    totalUsers: number;
    success: boolean;
  };
  firestoreRestore: {
    collectionsDir: string;
    totalCollections: number;
    success: boolean;
  };
  rulesRestore: {
    rulesDir: string;
    rulesRestored: number;
    success: boolean;
  };
}

/**
 * Read backup report to get metadata
 */
function readBackupReport(backupDir: string): Record<string, unknown> | null {
  const reportPath = path.join(backupDir, 'backup-report.json');
  if (fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * Main restore function
 */
async function restoreFirebase(backupDir: string, dryRun: boolean = false): Promise<void> {
  try {
    console.log('🚀 Starting complete Firebase restore...\n');

    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory not found: ${backupDir}`);
    }

    // Read backup report if available
    const backupReport = readBackupReport(backupDir);
    if (backupReport) {
      console.log('📄 Backup Report Found:');
      console.log(`   Project ID: ${backupReport.projectId || 'unknown'}`);
      console.log(`   Backup Date: ${backupReport.timestamp || 'unknown'}`);
      console.log(`   Auth Users: ${backupReport.authBackup?.totalUsers || 0}`);
      console.log(`   Firestore Collections: ${backupReport.firestoreBackup?.totalCollections || 0}`);
      console.log(`   Firestore Documents: ${backupReport.firestoreBackup?.totalDocuments || 0}`);
      if (backupReport.rulesBackup) {
        const rulesBackup = backupReport.rulesBackup as { firestoreRules?: { exists?: boolean }; storageRules?: { exists?: boolean } };
        const rulesCount = [rulesBackup.firestoreRules?.exists, rulesBackup.storageRules?.exists].filter(Boolean).length;
        console.log(`   Security Rules: ${rulesCount} files`);
      }
      console.log('');
    }

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    const restoreReport: RestoreReport = {
      timestamp: new Date().toISOString(),
      backupDirectory: backupDir,
      authRestore: {
        usersFile: '',
        totalUsers: 0,
        success: false,
      },
      firestoreRestore: {
        collectionsDir: '',
        totalCollections: 0,
        success: false,
      },
      rulesRestore: {
        rulesDir: '',
        rulesRestored: 0,
        success: false,
      },
    };

    // Step 1: Restore Authentication users
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 1: Restoring Firebase Authentication users');
    console.log('═══════════════════════════════════════════════════════\n');

    const authBackupDir = path.join(backupDir, 'auth');
    const usersFilePath = path.join(authBackupDir, 'users.json');

    if (fs.existsSync(usersFilePath)) {
      try {
        // Count users in backup
        const usersContent = fs.readFileSync(usersFilePath, 'utf-8');
        const users = JSON.parse(usersContent);
        const userCount = Array.isArray(users) ? users.length : 0;

        restoreReport.authRestore.usersFile = usersFilePath;
        restoreReport.authRestore.totalUsers = userCount;

        await restoreAuthUsers(usersFilePath, dryRun);
        restoreReport.authRestore.success = true;
        console.log(`\n✅ Auth restore completed: ${userCount} users`);
      } catch (error) {
        console.error(`\n❌ Auth restore failed:`, error);
        restoreReport.authRestore.success = false;
        if (!dryRun) {
          throw error;
        }
      }
    } else {
      console.log(`⚠️  Auth backup not found: ${usersFilePath}`);
      console.log(`   Skipping auth restore...`);
    }

    console.log('\n');

    // Step 2: Restore Firestore database
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 2: Restoring Firestore database');
    console.log('═══════════════════════════════════════════════════════\n');

    const firestoreBackupDir = path.join(backupDir, 'firestore');
    const collectionsDir = path.join(firestoreBackupDir, 'collections');

    if (fs.existsSync(collectionsDir)) {
      try {
        // Count collections in backup
        const collectionFiles = fs.readdirSync(collectionsDir)
          .filter(file => file.endsWith('.json'));
        const collectionCount = collectionFiles.length;

        restoreReport.firestoreRestore.collectionsDir = collectionsDir;
        restoreReport.firestoreRestore.totalCollections = collectionCount;

        await restoreFirestore(firestoreBackupDir, dryRun);
        restoreReport.firestoreRestore.success = true;
        console.log(`\n✅ Firestore restore completed: ${collectionCount} collections`);
      } catch (error) {
        console.error(`\n❌ Firestore restore failed:`, error);
        restoreReport.firestoreRestore.success = false;
        if (!dryRun) {
          throw error;
        }
      }
    } else {
      console.log(`⚠️  Firestore backup not found: ${collectionsDir}`);
      console.log(`   Skipping Firestore restore...`);
    }

    console.log('\n');

    // Step 3: Restore Security Rules
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 3: Restoring Firebase Security Rules');
    console.log('═══════════════════════════════════════════════════════\n');

    const rulesBackupDir = path.join(backupDir, 'rules');

    if (fs.existsSync(rulesBackupDir)) {
      try {
        // Count rules files in backup
        const rulesFiles = fs.readdirSync(rulesBackupDir)
          .filter(file => file.endsWith('.rules'));
        const rulesCount = rulesFiles.length;

        restoreReport.rulesRestore.rulesDir = rulesBackupDir;
        restoreReport.rulesRestore.rulesRestored = rulesCount;

        await restoreFirebaseRules(rulesBackupDir, dryRun);
        restoreReport.rulesRestore.success = true;
        console.log(`\n✅ Rules restore completed: ${rulesCount} rules files`);
      } catch (error) {
        console.error(`\n❌ Rules restore failed:`, error);
        restoreReport.rulesRestore.success = false;
        if (!dryRun) {
          throw error;
        }
      }
    } else {
      console.log(`⚠️  Rules backup not found: ${rulesBackupDir}`);
      console.log(`   Skipping Rules restore...`);
    }

    // Step 4: Create restore report
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('STEP 4: Creating restore report');
    console.log('═══════════════════════════════════════════════════════\n');

    const reportPath = path.join(backupDir, 'restore-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(restoreReport, null, 2),
      'utf-8'
    );

    // Print final summary
    console.log('✅ Complete restore finished!\n');
    console.log('📊 Restore Summary:');
    console.log(`   📁 Backup directory: ${backupDir}`);
    console.log(`   👥 Auth users: ${restoreReport.authRestore.totalUsers} ${restoreReport.authRestore.success ? '✅' : '❌'}`);
    console.log(`   📚 Firestore collections: ${restoreReport.firestoreRestore.totalCollections} ${restoreReport.firestoreRestore.success ? '✅' : '❌'}`);
    console.log(`   📋 Security Rules: ${restoreReport.rulesRestore.rulesRestored} ${restoreReport.rulesRestore.success ? '✅' : '❌'}`);
    console.log(`   📄 Restore report: ${reportPath}`);

    if (dryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to actually restore data.');
    } else {
      const allSuccess = restoreReport.authRestore.success && restoreReport.firestoreRestore.success && restoreReport.rulesRestore.success;
      if (!allSuccess) {
        console.log('\n⚠️  Some restore operations failed. Check the errors above.');
      } else {
        console.log('\n✨ All data has been restored successfully!');
      }
    }

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run restore if script is executed directly
if (require.main === module) {
  const backupDir = process.argv[2];
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

  if (!backupDir) {
    console.error('❌ Error: Backup directory path is required');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/restore-firebase.ts <backup-directory-path> [--dry-run]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00');
    console.error('  npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00 --dry-run');
    process.exit(1);
  }

  restoreFirebase(backupDir, dryRun)
    .then(() => {
      console.log('\n✨ Complete restore process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { restoreFirebase };

