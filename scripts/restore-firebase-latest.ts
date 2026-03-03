#!/usr/bin/env node
/**
 * Restore Latest Firestore Backup
 * 
 * Finds the most recent backup and restores it.
 * 
 * Usage:
 *   npx tsx scripts/restore-firebase-latest.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { restoreFirestore } from './restore-firestore';

function findLatestBackup(): string | null {
  const backupsDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupsDir)) {
    return null;
  }

  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const backupDirs = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('firestore-backup-'))
    .map(entry => ({
      name: entry.name,
      path: path.join(backupsDir, entry.name, 'firestore'),
      fullPath: path.join(backupsDir, entry.name),
      mtime: fs.statSync(path.join(backupsDir, entry.name)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return backupDirs.length > 0 ? backupDirs[0].path : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

  console.log('🔍 Looking for latest backup...\n');

  const latestBackup = findLatestBackup();

  if (!latestBackup) {
    console.error('❌ No backups found in ./backups directory');
    console.error('\n💡 Create a backup first:');
    console.error('   yarn backup:all');
    process.exit(1);
  }

  console.log(`✅ Found latest backup: ${latestBackup}\n`);

  await restoreFirestore(latestBackup, dryRun);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
