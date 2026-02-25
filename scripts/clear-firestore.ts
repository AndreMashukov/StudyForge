#!/usr/bin/env node
/**
 * Firestore Database Clear Script (User-Scoped Collections)
 * 
 * ⚠️  WARNING: This script will DELETE user-scoped data from Firestore! ⚠️
 * 
 * This script clears the user-scoped subcollections under each user:
 *   - users/{userId}/documents
 *   - users/{userId}/quizzes
 *   - users/{userId}/directories
 *   - users/{userId}/rules
 * 
 * Usage:
 *   # Dry run (preview what will be deleted)
 *   npx tsx scripts/clear-firestore.ts --dry-run
 * 
 *   # Actually clear Firestore (requires confirmation)
 *   npx tsx scripts/clear-firestore.ts
 * 
 *   # Force clear without confirmation (dangerous!)
 *   npx tsx scripts/clear-firestore.ts --force
 * 
 * The script will:
 * 1. Initialize Firebase Admin SDK
 * 2. List all user documents under users/
 * 3. For each user, recursively delete documents, quizzes, directories, and rules subcollections
 * 4. Provide progress updates during deletion
 * 5. Summary of deleted subcollections and documents
 * 
 * Safety Features:
 * - Requires explicit confirmation before deletion (unless --force is used)
 * - Dry run mode to preview what will be deleted
 * - Detailed logging of all operations
 * - Error handling and reporting
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as readline from 'readline';
import { config } from 'dotenv';

// Load environment variables from .env.local ONLY if not in production mode
// Use --production flag to skip loading emulator config
const isProductionMode = process.argv.includes('--production') || process.argv.includes('-p');
if (!isProductionMode) {
  config({ path: path.join(process.cwd(), '.env.local') });
}

interface CollectionStats {
  name: string;
  documentsDeleted: number;
  subcollectionsDeleted: number;
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(projectId?: string): void {
  if (admin.apps.length === 0) {
    // Check if running with emulators
    const useEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
    
    if (useEmulator) {
      // Initialize for emulator
      const finalProjectId = projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '[REDACTED]';
      
      // Set emulator environment variables if not already set
      if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      }
      
      admin.initializeApp({
        projectId: finalProjectId,
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode)');
      console.log(`   Project ID: ${finalProjectId}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    } else {
      // Initialize with default credentials (for production)
      const finalProjectId = projectId || '[REDACTED]';
      
      try {
        admin.initializeApp({
          projectId: finalProjectId,
        });
        const appProjectId = admin.app().options.projectId || 'unknown-project';
        console.log('✅ Firebase Admin SDK initialized (Production mode)');
        console.log(`   Project ID: ${appProjectId}`);
        
        const creds = admin.app().options.credential;
        if (creds) {
          console.log('   ✅ Credentials found');
        } else {
          console.log('   ⚠️  Using Application Default Credentials');
        }
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK');
        console.error('\n💡 Setup Instructions:');
        console.error('   For PRODUCTION:');
        console.error('   1. Set GOOGLE_APPLICATION_CREDENTIALS:');
        console.error('      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"');
        console.error('   2. Or use Application Default Credentials:');
        console.error('      gcloud auth application-default login');
        console.error('\n   For EMULATOR:');
        console.error('   1. Start Firebase emulators:');
        console.error('      firebase emulators:start');
        console.error('   2. Set emulator environment variables in .env.local:');
        console.error('      FIREBASE_AUTH_EMULATOR_HOST=localhost:9099');
        console.error('      FIRESTORE_EMULATOR_HOST=localhost:8080');
        console.error('      GCLOUD_PROJECT=[REDACTED]');
        throw error;
      }
    }
  }
}

/**
 * Delete all documents in a collection (including subcollections)
 * Firestore requires deleting documents in batches of up to 500
 */
async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  batchSize = 500,
  dryRun = false
): Promise<{ documentsDeleted: number; subcollectionsDeleted: number }> {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, dryRun, resolve, reject, 0, 0);
  });

  async function deleteQueryBatch(
    db: admin.firestore.Firestore,
    query: admin.firestore.Query,
    batchSize: number,
    dryRun: boolean,
    resolve: (value: { documentsDeleted: number; subcollectionsDeleted: number }) => void,
    reject: (reason?: unknown) => void,
    totalDeleted: number,
    totalSubcollections: number
  ): Promise<void> {
    try {
      const snapshot = await query.get();

      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        resolve({ documentsDeleted: totalDeleted, subcollectionsDeleted: totalSubcollections });
        return;
      }

      // Delete documents in a batch
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        // First, delete all subcollections
        const subcollections = await doc.ref.listCollections();
        for (const subcollection of subcollections) {
          const subcolPath = `${collectionPath}/${doc.id}/${subcollection.id}`;
          const { documentsDeleted: subDocs } = 
            await deleteCollection(db, subcolPath, batchSize, dryRun);
          totalSubcollections++;
          totalDeleted += subDocs;
          
          if (dryRun) {
            console.log(`      [DRY RUN] Would delete subcollection: ${subcolPath} (${subDocs} docs)`);
          }
        }

        // Then delete the document itself
        if (!dryRun) {
          batch.delete(doc.ref);
        }
        batchCount++;
      }

      if (!dryRun) {
        await batch.commit();
      }

      totalDeleted += batchCount;

      if (batchCount > 0) {
        if (dryRun) {
          console.log(`      [DRY RUN] Would delete ${batchCount} documents from ${collectionPath} (total: ${totalDeleted})`);
        } else {
          console.log(`      Deleted ${batchCount} documents from ${collectionPath} (total: ${totalDeleted})`);
        }
      }

      // Recurse on the next process tick to avoid blocking
      process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, dryRun, resolve, reject, totalDeleted, totalSubcollections);
      });
    } catch (error) {
      reject(error);
    }
  }
}

/**
 * Prompt user for confirmation
 */
async function confirmDeletion(projectId: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  ========================================');
    console.log('⚠️  WARNING: DESTRUCTIVE OPERATION');
    console.log('⚠️  ========================================');
    console.log(`⚠️  You are about to DELETE ALL DATA from Firestore!`);
    console.log(`⚠️  Project ID: ${projectId}`);
    console.log('⚠️  This action CANNOT be undone!');
    console.log('⚠️  ========================================\n');

    rl.question('Are you absolutely sure you want to continue? Type "DELETE ALL DATA" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'DELETE ALL DATA');
    });
  });
}

// Subcollections to clear under each user document
const USER_SUBCOLLECTIONS = ['documents', 'quizzes', 'directories', 'rules'];

/**
 * Main clear function
 * 
 * Clears user-scoped subcollections:
 *   users/{userId}/documents, users/{userId}/quizzes,
 *   users/{userId}/directories, users/{userId}/rules
 */
async function clearFirestore(dryRun = false, force = false): Promise<void> {
  try {
    // Initialize Firebase with explicit project ID
    initializeFirebase('[REDACTED]');

    const db = admin.firestore();
    const app = admin.app();
    const projectId = app.options.projectId || 'unknown-project';

    console.log(`\n🔐 Project ID: ${projectId}`);
    console.log(`🗄️  Database ID: (default)`);

    // Get confirmation unless force flag is set or dry run
    if (!dryRun && !force) {
      const confirmed = await confirmDeletion(projectId);
      if (!confirmed) {
        console.log('\n❌ Operation cancelled by user');
        process.exit(0);
      }
    }

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No data will be deleted\n');
    } else if (force) {
      console.log('\n⚡ FORCE MODE - Skipping confirmation\n');
    }

    // List all user documents
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();

    console.log(`\n👤 Found ${usersSnapshot.size} user(s)`);
    console.log(`📚 Subcollections to clear: ${USER_SUBCOLLECTIONS.join(', ')}`);

    if (usersSnapshot.size === 0) {
      console.log('✅ No users found - nothing to clear');
      return;
    }

    const collectionStats: CollectionStats[] = [];
    let totalDocuments = 0;
    let totalSubcollections = 0;

    // For each user, delete their subcollections
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 ${dryRun ? '[DRY RUN] Would clear' : 'Clearing'} user: ${userId}`);

      for (const subcollectionName of USER_SUBCOLLECTIONS) {
        const subcollectionPath = `users/${userId}/${subcollectionName}`;
        console.log(`   🗑️  ${dryRun ? '[DRY RUN] Would delete' : 'Deleting'}: ${subcollectionPath}`);

        try {
          const { documentsDeleted, subcollectionsDeleted } = await deleteCollection(
            db,
            subcollectionPath,
            500,
            dryRun
          );

          collectionStats.push({
            name: subcollectionPath,
            documentsDeleted: documentsDeleted,
            subcollectionsDeleted: subcollectionsDeleted,
          });

          totalDocuments += documentsDeleted;
          totalSubcollections += subcollectionsDeleted;

          if (dryRun) {
            console.log(`      ✅ [DRY RUN] Would delete ${documentsDeleted} documents`);
          } else {
            console.log(`      ✅ Deleted ${documentsDeleted} documents`);
          }
        } catch (error) {
          console.error(`      ❌ Error deleting ${subcollectionPath}:`, error);
          throw error;
        }
      }
    }

    // Print summary
    console.log(`\n${dryRun ? '📋 DRY RUN SUMMARY' : '✅ CLEAR COMPLETED SUCCESSFULLY'}`);
    console.log(`   👤 Users processed: ${usersSnapshot.size}`);
    console.log(`   📄 Total documents ${dryRun ? 'that would be deleted' : 'deleted'}: ${totalDocuments}`);
    console.log(`   📁 Subcollections ${dryRun ? 'that would be deleted' : 'deleted'}: ${totalSubcollections}`);

    console.log(`\n📊 Subcollection Statistics:`);
    for (const stat of collectionStats) {
      if (stat.documentsDeleted > 0) {
        console.log(`   ${stat.name}: ${stat.documentsDeleted} documents, ${stat.subcollectionsDeleted} subcollections`);
      }
    }

    if (dryRun) {
      console.log(`\n💡 This was a dry run. Run without --dry-run to actually delete data.`);
      console.log(`   Command: npx tsx scripts/clear-firestore.ts`);
    } else {
      console.log(`\n⚠️  All user-scoped data has been permanently deleted from Firestore!`);
      
      // Suggest creating a backup next time
      console.log(`\n💡 Tip: Always create a backup before clearing data:`);
      console.log(`   npx tsx scripts/backup-firestore.ts`);
    }

  } catch (error) {
    console.error('❌ Clear operation failed:', error);
    process.exit(1);
  }
}

// Run clear if script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const force = args.includes('--force') || args.includes('-f');

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Firestore Clear Script (User-Scoped Collections)');
    console.log('');
    console.log('⚠️  WARNING: This script will DELETE user-scoped data from Firestore! ⚠️');
    console.log('');
    console.log('Clears subcollections under each user:');
    console.log('  users/{userId}/documents, users/{userId}/quizzes,');
    console.log('  users/{userId}/directories, users/{userId}/rules');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/clear-firestore.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --production, -p   Clear PRODUCTION Firestore (ignores .env.local emulator config)');
    console.log('  --dry-run, -d      Preview what will be deleted without actually deleting');
    console.log('  --force, -f        Skip confirmation prompt (dangerous!)');
    console.log('  --help, -h         Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  # Dry run on PRODUCTION (safe - just preview)');
    console.log('  npx tsx scripts/clear-firestore.ts --production --dry-run');
    console.log('');
    console.log('  # Clear PRODUCTION with confirmation prompt');
    console.log('  npx tsx scripts/clear-firestore.ts --production');
    console.log('');
    console.log('  # Clear EMULATOR (uses .env.local settings)');
    console.log('  npx tsx scripts/clear-firestore.ts');
    console.log('');
    console.log('  # Clear without confirmation (dangerous!)');
    console.log('  npx tsx scripts/clear-firestore.ts --production --force');
    console.log('');
    console.log('Environment:');
    console.log('  For PRODUCTION:');
    console.log('    Use --production flag AND set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth');
    console.log('  For EMULATOR:');
    console.log('    Set FIRESTORE_EMULATOR_HOST=localhost:8080 in .env.local (default behavior)');
    process.exit(0);
  }

  clearFirestore(dryRun, force)
    .then(() => {
      console.log('\n✨ Clear process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { clearFirestore };
