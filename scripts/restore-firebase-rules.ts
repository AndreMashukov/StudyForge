#!/usr/bin/env node
/**
 * Firebase Rules Restore Script
 * 
 * This script restores Firebase Security Rules (Firestore and Storage rules) from backup.
 * 
 * Usage:
 *   npx tsx scripts/restore-firebase-rules.ts <backup-directory-path> [--dry-run]
 * 
 * Example:
 *   npx tsx scripts/restore-firebase-rules.ts backups/firebase-backup-2024-01-01_12-00-00/rules
 * 
 * The script will:
 * 1. Load rules files from backup directory
 * 2. Restore firestore.rules and storage.rules to project root
 * 3. Create backups of existing rules before overwriting
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Restore Firebase rules from backup
 */
async function restoreFirebaseRules(backupDir: string, dryRun: boolean = false): Promise<void> {
  try {
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory not found: ${backupDir}`);
    }

    const projectRoot = process.cwd();
    const firestoreRulesBackup = path.join(backupDir, 'firestore.rules');
    const storageRulesBackup = path.join(backupDir, 'storage.rules');
    const firestoreRulesTarget = path.join(projectRoot, 'firestore.rules');
    const storageRulesTarget = path.join(projectRoot, 'storage.rules');

    console.log('📋 Restoring Firebase Security Rules...\n');
    console.log(`📂 Backup directory: ${backupDir}`);
    console.log(`📁 Project root: ${projectRoot}\n`);

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    let restoredCount = 0;

    // Restore Firestore rules
    if (fs.existsSync(firestoreRulesBackup)) {
      const rulesContent = fs.readFileSync(firestoreRulesBackup, 'utf-8');
      
      if (dryRun) {
        console.log(`✅ Would restore Firestore rules (${rulesContent.length} bytes)`);
        console.log(`   From: ${firestoreRulesBackup}`);
        console.log(`   To: ${firestoreRulesTarget}`);
      } else {
        // Backup existing rules if they exist
        if (fs.existsSync(firestoreRulesTarget)) {
          const backupPath = `${firestoreRulesTarget}.backup.${Date.now()}`;
          fs.copyFileSync(firestoreRulesTarget, backupPath);
          console.log(`💾 Backed up existing Firestore rules to: ${backupPath}`);
        }

        fs.writeFileSync(firestoreRulesTarget, rulesContent, 'utf-8');
        console.log(`✅ Restored Firestore rules (${rulesContent.length} bytes)`);
        restoredCount++;
      }
    } else {
      console.log(`⚠️  Firestore rules backup not found: ${firestoreRulesBackup}`);
    }

    // Restore Storage rules
    if (fs.existsSync(storageRulesBackup)) {
      const rulesContent = fs.readFileSync(storageRulesBackup, 'utf-8');
      
      if (dryRun) {
        console.log(`✅ Would restore Storage rules (${rulesContent.length} bytes)`);
        console.log(`   From: ${storageRulesBackup}`);
        console.log(`   To: ${storageRulesTarget}`);
      } else {
        // Backup existing rules if they exist
        if (fs.existsSync(storageRulesTarget)) {
          const backupPath = `${storageRulesTarget}.backup.${Date.now()}`;
          fs.copyFileSync(storageRulesTarget, backupPath);
          console.log(`💾 Backed up existing Storage rules to: ${storageRulesTarget}.backup.${Date.now()}`);
        }

        fs.writeFileSync(storageRulesTarget, rulesContent, 'utf-8');
        console.log(`✅ Restored Storage rules (${rulesContent.length} bytes)`);
        restoredCount++;
      }
    } else {
      console.log(`⚠️  Storage rules backup not found: ${storageRulesBackup}`);
    }

    console.log(`\n✅ Rules restore completed successfully!`);
    console.log(`   📄 Rules restored: ${restoredCount}`);

    if (dryRun) {
      console.log(`\n💡 This was a dry run. Run without --dry-run to actually restore rules.`);
    } else {
      console.log(`\n💡 Note: Rules files have been restored to your project root.`);
      console.log(`   You may need to deploy them: firebase deploy --only firestore:rules,storage`);
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
    console.error('  npx tsx scripts/restore-firebase-rules.ts <backup-directory-path> [--dry-run]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/restore-firebase-rules.ts backups/firebase-backup-2024-01-01_12-00-00/rules');
    console.error('  npx tsx scripts/restore-firebase-rules.ts backups/firebase-backup-2024-01-01_12-00-00/rules --dry-run');
    process.exit(1);
  }

  restoreFirebaseRules(backupDir, dryRun)
    .then(() => {
      console.log('\n✨ Restore process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { restoreFirebaseRules };

