#!/usr/bin/env node
/**
 * Restore Latest Firebase Backup Script
 * 
 * This script automatically finds and restores the most recent Firebase backup.
 * It scans the backups directory and selects the backup with the latest timestamp.
 * 
 * Usage:
 *   npx tsx scripts/restore-firebase-latest.ts [--dry-run]
 * 
 * Example:
 *   npx tsx scripts/restore-firebase-latest.ts
 *   npx tsx scripts/restore-firebase-latest.ts --dry-run
 * 
 * The script will:
 * 1. Scan the backups directory for available backups
 * 2. Find the backup with the latest timestamp
 * 3. Restore that backup using the complete restore script
 */

import * as fs from 'fs';
import * as path from 'path';
import { restoreFirebase } from './restore-firebase';

/**
 * Parse timestamp from backup directory name
 * Format: firebase-backup-YYYY-MM-DD_HH-MM-SS-SSSZ
 */
function parseBackupTimestamp(dirName: string): Date | null {
  // Match pattern: firebase-backup-YYYY-MM-DD_HH-MM-SS-SSSZ
  // Example: firebase-backup-2025-11-09_08-39-42-056Z
  const match = dirName.match(/firebase-backup-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
  
  if (!match) {
    return null;
  }

  try {
    // Convert timestamp format: YYYY-MM-DD_HH-MM-SS-SSSZ
    // to ISO format: YYYY-MM-DDTHH:MM:SS.SSSZ
    const datePart = match[1]; // YYYY-MM-DD
    const hour = match[2];      // HH
    const minute = match[3];   // MM
    const second = match[4];   // SS
    const millisecond = match[5]; // SSS
    
    const isoString = `${datePart}T${hour}:${minute}:${second}.${millisecond}Z`;
    const date = new Date(isoString);
    
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Find the latest backup directory
 */
function findLatestBackup(backupsDir: string): string | null {
  if (!fs.existsSync(backupsDir)) {
    return null;
  }

  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const backupDirs: Array<{ path: string; timestamp: Date }> = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('firebase-backup-')) {
      const timestamp = parseBackupTimestamp(entry.name);
      if (timestamp) {
        backupDirs.push({
          path: path.join(backupsDir, entry.name),
          timestamp: timestamp,
        });
      }
    }
  }

  if (backupDirs.length === 0) {
    return null;
  }

  // Sort by timestamp (newest first)
  backupDirs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return backupDirs[0].path;
}

/**
 * List all available backups
 */
function listAvailableBackups(backupsDir: string): Array<{ path: string; timestamp: Date; name: string }> {
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const backups: Array<{ path: string; timestamp: Date; name: string }> = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('firebase-backup-')) {
      const timestamp = parseBackupTimestamp(entry.name);
      if (timestamp) {
        backups.push({
          path: path.join(backupsDir, entry.name),
          timestamp: timestamp,
          name: entry.name,
        });
      }
    }
  }

  // Sort by timestamp (newest first)
  backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return backups;
}

/**
 * Main function to restore latest backup
 */
async function restoreLatestBackup(dryRun: boolean = false): Promise<void> {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');

    console.log('🔍 Searching for backups...\n');

    // List all available backups
    const availableBackups = listAvailableBackups(backupsDir);

    if (availableBackups.length === 0) {
      console.error('❌ No backups found in:', backupsDir);
      console.error('\n💡 Create a backup first:');
      console.error('   yarn backup:firebase');
      process.exit(1);
    }

    // Display available backups
    console.log(`📦 Found ${availableBackups.length} backup(s):\n`);
    availableBackups.forEach((backup, index) => {
      const isLatest = index === 0;
      const marker = isLatest ? '👉 ' : '   ';
      const dateStr = backup.timestamp.toLocaleString();
      console.log(`${marker}${index + 1}. ${backup.name}`);
      console.log(`      Date: ${dateStr}`);
      console.log(`      Path: ${backup.path}\n`);
    });

    // Get the latest backup
    const latestBackup = availableBackups[0];

    console.log('═══════════════════════════════════════════════════════');
    console.log(`🎯 Selected Latest Backup:`);
    console.log(`   ${latestBackup.name}`);
    console.log(`   ${latestBackup.timestamp.toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      // Confirm before proceeding (unless dry-run)
      console.log('⚠️  This will restore data from the backup.');
      console.log('   Existing data may be overwritten.\n');
    }

    // Restore the latest backup
    await restoreFirebase(latestBackup.path, dryRun);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run restore if script is executed directly
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  const listOnly = process.argv.includes('--list') || process.argv.includes('-l');

  if (listOnly) {
    // Just list backups without restoring
    const backupsDir = path.join(process.cwd(), 'backups');
    const backups = listAvailableBackups(backupsDir);

    if (backups.length === 0) {
      console.log('❌ No backups found in:', backupsDir);
      process.exit(1);
    }

    console.log(`📦 Available Backups (${backups.length}):\n`);
    backups.forEach((backup, index) => {
      const isLatest = index === 0;
      const marker = isLatest ? '👉 LATEST' : `   #${index + 1}`;
      const dateStr = backup.timestamp.toLocaleString();
      console.log(`${marker}`);
      console.log(`   Name: ${backup.name}`);
      console.log(`   Date: ${dateStr}`);
      console.log(`   Path: ${backup.path}\n`);
    });
    process.exit(0);
  }

  restoreLatestBackup(dryRun)
    .then(() => {
      console.log('\n✨ Latest backup restore completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { restoreLatestBackup, findLatestBackup, listAvailableBackups };

