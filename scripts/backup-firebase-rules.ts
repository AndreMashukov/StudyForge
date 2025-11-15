#!/usr/bin/env node
/**
 * Firebase Rules Backup Script
 * 
 * This script backs up Firebase Security Rules (Firestore and Storage rules).
 * Rules are stored as files in the project, not in Firestore.
 * 
 * Usage:
 *   npx tsx scripts/backup-firebase-rules.ts [output-dir]
 * 
 * The script will:
 * 1. Read firestore.rules and storage.rules files
 * 2. Save them to the backup directory
 * 3. Include metadata about the rules
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface RulesBackupMetadata {
  timestamp: string;
  projectId: string;
  backupVersion: string;
  firestoreRules: {
    exists: boolean;
    size: number;
    path: string;
  };
  storageRules: {
    exists: boolean;
    size: number;
    path: string;
  };
}

/**
 * Backup Firebase rules
 */
async function backupFirebaseRules(outputDir?: string): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const firestoreRulesPath = path.join(projectRoot, 'firestore.rules');
    const storageRulesPath = path.join(projectRoot, 'storage.rules');

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];
    const backupDir = outputDir || path.join(projectRoot, 'backups', `rules-backup-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }

    console.log('📋 Backing up Firebase Security Rules...\n');

    const metadata: RulesBackupMetadata = {
      timestamp: new Date().toISOString(),
      projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai',
      backupVersion: '1.0.0',
      firestoreRules: {
        exists: false,
        size: 0,
        path: firestoreRulesPath,
      },
      storageRules: {
        exists: false,
        size: 0,
        path: storageRulesPath,
      },
    };

    // Backup Firestore rules
    if (fs.existsSync(firestoreRulesPath)) {
      const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
      const backupPath = path.join(backupDir, 'firestore.rules');
      fs.writeFileSync(backupPath, rulesContent, 'utf-8');
      
      metadata.firestoreRules.exists = true;
      metadata.firestoreRules.size = rulesContent.length;
      
      console.log(`✅ Backed up Firestore rules (${rulesContent.length} bytes)`);
    } else {
      console.log(`⚠️  Firestore rules file not found: ${firestoreRulesPath}`);
    }

    // Backup Storage rules
    if (fs.existsSync(storageRulesPath)) {
      const rulesContent = fs.readFileSync(storageRulesPath, 'utf-8');
      const backupPath = path.join(backupDir, 'storage.rules');
      fs.writeFileSync(backupPath, rulesContent, 'utf-8');
      
      metadata.storageRules.exists = true;
      metadata.storageRules.size = rulesContent.length;
      
      console.log(`✅ Backed up Storage rules (${rulesContent.length} bytes)`);
    } else {
      console.log(`⚠️  Storage rules file not found: ${storageRulesPath}`);
    }

    // Save metadata
    const metadataPath = path.join(backupDir, 'metadata.json');
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Rules backup completed successfully!`);
    console.log(`   📁 Backup directory: ${backupDir}`);
    console.log(`   📄 Firestore rules: ${metadata.firestoreRules.exists ? '✅' : '❌'}`);
    console.log(`   📄 Storage rules: ${metadata.storageRules.exists ? '✅' : '❌'}`);
    console.log(`   📄 Metadata file: ${metadataPath}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  const outputDir = process.argv[2];
  backupFirebaseRules(outputDir)
    .then(() => {
      console.log('\n✨ Backup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { backupFirebaseRules };

