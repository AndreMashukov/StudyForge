#!/usr/bin/env node
/**
 * Firestore Database Restore Script (User-Scoped Collections)
 * 
 * This script restores user-scoped Firestore collections from backup JSON files.
 * It restores the users collection with all subcollections:
 *   - users/{userId}/documents
 *   - users/{userId}/quizzes
 *   - users/{userId}/directories
 *   - users/{userId}/rules
 * 
 * Usage:
 *   npx tsx scripts/restore-firestore.ts <backup-directory-path>
 * 
 * Example:
 *   npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore
 * 
 * The script will:
 * 1. Load the users collection backup from the backup directory
 * 2. Initialize Firebase Admin SDK
 * 3. Restore user documents and subcollections into users/{userId}/...
 * 4. Convert ISO timestamps back to Firestore Timestamps
 * 5. Handle GeoPoints and DocumentReferences
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface DocumentBackup {
  id: string;
  data: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
  subcollections?: Record<string, DocumentBackup[]>;
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
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
      if (!projectId) {
        throw new Error(
          'GCLOUD_PROJECT or GCP_PROJECT environment variable must be set when using emulators. ' +
          'Add GCLOUD_PROJECT=your-project-id to your .env.local file.'
        );
      }
      
      // Set emulator environment variables if not already set
      if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      }
      
      admin.initializeApp({
        projectId: projectId,
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
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
        console.error('   2. Set FIRESTORE_EMULATOR_HOST=localhost:8080 in .env.local');
        throw error;
      }
    }
  }
}

/**
 * Convert ISO string back to Firestore Timestamp
 */
function convertFromBackupFormat(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle GeoPoint
  if (typeof value === 'object' && value !== null && '_type' in value) {
    const typedValue = value as { _type: string; [key: string]: unknown };
    
    if (typedValue._type === 'geopoint' && 'latitude' in typedValue && 'longitude' in typedValue) {
      return new admin.firestore.GeoPoint(
        typedValue.latitude as number,
        typedValue.longitude as number
      );
    }

    if (typedValue._type === 'reference' && 'path' in typedValue) {
      const db = admin.firestore();
      return db.doc(typedValue.path as string);
    }
  }

  // Handle ISO date strings (convert back to Timestamp)
  if (typeof value === 'string') {
    // Check if it's an ISO date string
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoDateRegex.test(value)) {
      return admin.firestore.Timestamp.fromDate(new Date(value));
    }
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(convertFromBackupFormat);
  }

  // Handle objects
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertFromBackupFormat(val);
    }
    return result;
  }

  return value;
}

/**
 * Restore a single document with its subcollections
 */
async function restoreDocument(
  docBackup: DocumentBackup,
  collectionRef: admin.firestore.CollectionReference,
  dryRun: boolean = false
): Promise<void> {
  const docRef = collectionRef.doc(docBackup.id);
  
  // Convert data from backup format to Firestore format
  const firestoreData = convertFromBackupFormat(docBackup.data) as Record<string, unknown>;

  if (!dryRun) {
    // Set document data
    await docRef.set(firestoreData);
  }

  // Restore subcollections recursively
  if (docBackup.subcollections) {
    for (const [subcollectionName, subcollectionDocs] of Object.entries(docBackup.subcollections)) {
      const subcollectionRef = docRef.collection(subcollectionName);
      
      for (const subDoc of subcollectionDocs) {
        await restoreDocument(subDoc, subcollectionRef, dryRun);
      }
    }
  }
}

/**
 * Restore the users collection from backup file.
 * Each user document may have subcollections: documents, quizzes, directories, rules.
 * Restores into users/{userId}/... structure.
 */
async function restoreCollection(
  collectionName: string,
  collectionFilePath: string,
  db: admin.firestore.Firestore,
  dryRun: boolean = false
): Promise<{ documentCount: number; subcollectionCount: number }> {
  console.log(`\n📦 Restoring collection: ${collectionName}`);

  // Load collection backup
  if (!fs.existsSync(collectionFilePath)) {
    throw new Error(`Collection backup file not found: ${collectionFilePath}`);
  }

  const collectionContent = fs.readFileSync(collectionFilePath, 'utf-8');
  const documents: DocumentBackup[] = JSON.parse(collectionContent);

  if (!Array.isArray(documents)) {
    throw new Error(`Collection backup file must contain an array of documents: ${collectionFilePath}`);
  }

  console.log(`   Found ${documents.length} user document(s)`);

  const collectionRef = db.collection(collectionName);
  let documentCount = 0;
  let subcollectionCount = 0;

  // Restore user documents in batches
  const batchSize = 500; // Firestore batch limit
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(documents.length / batchSize);

    console.log(`   Processing batch ${batchNumber}/${totalBatches} (${batch.length} user documents)...`);

    if (dryRun) {
      documentCount += batch.length;
      batch.forEach(doc => {
        if (doc.subcollections && Object.keys(doc.subcollections).length > 0) {
          subcollectionCount++;
          const subcolNames = Object.keys(doc.subcollections);
          const subcolCounts = subcolNames.map(name => `${name}: ${doc.subcollections![name].length}`).join(', ');
          console.log(`      [DRY RUN] User ${doc.id} → ${subcolCounts}`);
        }
      });
    } else {
      // Use Firestore batch writes for efficiency
      const firestoreBatch = db.batch();
      let batchDocCount = 0;

      for (const docBackup of batch) {
        const docRef = collectionRef.doc(docBackup.id);
        const firestoreData = convertFromBackupFormat(docBackup.data) as Record<string, unknown>;
        firestoreBatch.set(docRef, firestoreData);
        batchDocCount++;

        // Count subcollections
        if (docBackup.subcollections && Object.keys(docBackup.subcollections).length > 0) {
          subcollectionCount++;
        }
      }

      await firestoreBatch.commit();
      documentCount += batchDocCount;
      console.log(`   ✅ Restored ${batchDocCount} user documents`);
    }
  }

  // Restore subcollections (must be done after parent user documents exist)
  if (!dryRun) {
    console.log(`   Restoring user subcollections (documents, quizzes, directories, rules)...`);
    for (const docBackup of documents) {
      if (docBackup.subcollections) {
        const docRef = collectionRef.doc(docBackup.id);
        for (const [subcollectionName, subcollectionDocs] of Object.entries(docBackup.subcollections)) {
          console.log(`      👤 users/${docBackup.id}/${subcollectionName}: ${subcollectionDocs.length} documents`);
          const subcollectionRef = docRef.collection(subcollectionName);
          for (const subDoc of subcollectionDocs) {
            await restoreDocument(subDoc, subcollectionRef, dryRun);
          }
        }
      }
    }
  }

  return { documentCount, subcollectionCount };
}

/**
 * Main restore function
 * 
 * Restores the user-scoped Firestore structure:
 *   users/{userId}/documents, users/{userId}/quizzes,
 *   users/{userId}/directories, users/{userId}/rules
 */
async function restoreFirestore(backupDir: string, dryRun: boolean = false): Promise<void> {
  try {
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory not found: ${backupDir}`);
    }

    // Initialize Firebase
    initializeFirebase();

    const db = admin.firestore();
    const collectionsDir = path.join(backupDir, 'collections');

    if (!fs.existsSync(collectionsDir)) {
      throw new Error(`Collections directory not found: ${collectionsDir}`);
    }

    // Look for the users.json backup file (user-scoped structure)
    const usersBackupPath = path.join(collectionsDir, 'users.json');
    if (!fs.existsSync(usersBackupPath)) {
      throw new Error(
        `users.json not found in ${collectionsDir}. ` +
        `Expected user-scoped backup with users/{userId}/... structure.`
      );
    }

    console.log(`📂 Backup directory: ${backupDir}`);
    console.log(`📚 Restoring user-scoped structure: users/{userId}/...`);
    console.log(`   Subcollections: documents, quizzes, directories, rules`);

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    }

    let totalDocuments = 0;
    let totalSubcollections = 0;

    // Restore the users collection with all subcollections
    try {
      const { documentCount, subcollectionCount } = await restoreCollection(
        'users',
        usersBackupPath,
        db,
        dryRun
      );
      totalDocuments += documentCount;
      totalSubcollections += subcollectionCount;
    } catch (error) {
      console.error(`   ❌ Error restoring users collection:`, error);
      throw error;
    }

    console.log(`\n✅ Restore completed successfully!`);
    console.log(`   👤 Users restored: ${totalDocuments}`);
    console.log(`   📁 Users with subcollections: ${totalSubcollections}`);

    if (dryRun) {
      console.log(`\n💡 This was a dry run. Run without --dry-run to actually restore data.`);
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
    console.error('  npx tsx scripts/restore-firestore.ts <backup-directory-path> [--dry-run]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore');
    console.error('  npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore --dry-run');
    process.exit(1);
  }

  restoreFirestore(backupDir, dryRun)
    .then(() => {
      console.log('\n✨ Restore process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { restoreFirestore };

