#!/usr/bin/env node
/**
 * Firestore Database Backup Script
 * 
 * This script exports all Firestore collections and documents to JSON files.
 * It recursively traverses all collections and subcollections to create a complete backup.
 * 
 * Usage:
 *   npx tsx scripts/backup-firestore.ts [output-dir]
 * 
 * The script will:
 * 1. Initialize Firebase Admin SDK
 * 2. List all top-level collections
 * 3. Recursively export all documents and subcollections
 * 4. Save data to organized JSON files with timestamp
 * 5. Preserve document structure and metadata
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

interface BackupMetadata {
  timestamp: string;
  projectId: string;
  databaseId: string;
  backupVersion: string;
  collections: string[];
  totalDocuments: number;
}

interface DocumentBackup {
  id: string;
  data: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
  subcollections?: Record<string, DocumentBackup[]>;
}

interface CollectionStats {
  name: string;
  documentCount: number;
  subcollectionCount: number;
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
      if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      }
      
      admin.initializeApp({
        projectId: projectId,
        // No credential needed for emulators!
      });
      
      console.log('✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)');
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
      console.log(`   Auth Emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST || 'not set'}`);
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
 * Convert Firestore Timestamp to ISO string
 */
function convertTimestamp(value: unknown): string | unknown {
  if (value && typeof value === 'object') {
    // Check if it's a Firestore Timestamp
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    // Check if it's a GeoPoint
    if ('latitude' in value && 'longitude' in value) {
      return {
        _type: 'geopoint',
        latitude: (value as { latitude: number }).latitude,
        longitude: (value as { longitude: number }).longitude,
      };
    }
    // Check if it's a DocumentReference
    if ('path' in value && 'id' in value) {
      return {
        _type: 'reference',
        path: (value as { path: string }).path,
        id: (value as { id: string }).id,
      };
    }
    // Recursively process objects
    if (Array.isArray(value)) {
      return value.map(convertTimestamp);
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertTimestamp(val);
    }
    return result;
  }
  return value;
}

/**
 * Export a single document with its subcollections
 */
async function exportDocument(
  docRef: admin.firestore.DocumentReference,
  collectionName: string
): Promise<DocumentBackup> {
  const doc = await docRef.get();
  
  if (!doc.exists) {
    throw new Error(`Document ${docRef.path} does not exist`);
  }

  const data = doc.data() || {};
  const convertedData = convertTimestamp(data) as Record<string, unknown>;

  const documentBackup: DocumentBackup = {
    id: doc.id,
    data: convertedData,
    createTime: doc.createTime?.toDate().toISOString(),
    updateTime: doc.updateTime?.toDate().toISOString(),
  };

  // Get subcollections
  const subcollections = await docRef.listCollections();
  if (subcollections.length > 0) {
    documentBackup.subcollections = {};
    
    for (const subcollection of subcollections) {
      const subcollectionName = subcollection.id;
      const subcollectionDocs = await exportCollection(subcollection, `${collectionName}/${doc.id}/${subcollectionName}`);
      documentBackup.subcollections[subcollectionName] = subcollectionDocs;
    }
  }

  return documentBackup;
}

/**
 * Export a collection with all its documents
 */
async function exportCollection(
  collectionRef: admin.firestore.CollectionReference,
  collectionPath: string
): Promise<DocumentBackup[]> {
  const documents: DocumentBackup[] = [];
  const snapshot = await collectionRef.get();

  console.log(`   📄 Exporting collection: ${collectionPath} (${snapshot.size} documents)`);

  // Process documents in batches to avoid memory issues
  const batchSize = 50;
  const docs = snapshot.docs;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const batchPromises = batch.map(doc => exportDocument(doc.ref, collectionPath));
    const batchResults = await Promise.all(batchPromises);
    documents.push(...batchResults);
    
    if (i + batchSize < docs.length) {
      console.log(`      Processed ${Math.min(i + batchSize, docs.length)}/${docs.length} documents...`);
    }
  }

  return documents;
}

/**
 * List all top-level collections
 */
async function listCollections(db: admin.firestore.Firestore): Promise<string[]> {
  const collections = await db.listCollections();
  return collections.map(col => col.id);
}

/**
 * Export all Firestore data
 */
async function exportAllFirestoreData(
  db: admin.firestore.Firestore,
  backupDir: string
): Promise<{ collections: CollectionStats[]; totalDocuments: number }> {
  const collections = await db.listCollections();
  const collectionStats: CollectionStats[] = [];
  let totalDocuments = 0;

  console.log(`\n📚 Found ${collections.length} top-level collections`);

  for (const collectionRef of collections) {
    const collectionName = collectionRef.id;
    console.log(`\n📦 Exporting collection: ${collectionName}`);

    try {
      const documents = await exportCollection(collectionRef, collectionName);
      
      // Save collection to file
      const collectionDir = path.join(backupDir, 'collections');
      if (!fs.existsSync(collectionDir)) {
        fs.mkdirSync(collectionDir, { recursive: true });
      }

      const collectionFile = path.join(collectionDir, `${collectionName}.json`);
      fs.writeFileSync(
        collectionFile,
        JSON.stringify(documents, null, 2),
        'utf-8'
      );

      // Count documents including subcollections
      const countDocuments = (docs: DocumentBackup[]): number => {
        let count = docs.length;
        for (const doc of docs) {
          if (doc.subcollections) {
            for (const subcol of Object.values(doc.subcollections)) {
              count += countDocuments(subcol);
            }
          }
        }
        return count;
      };

      const docCount = countDocuments(documents);
      const subcollectionCount = documents.filter(doc => doc.subcollections && Object.keys(doc.subcollections).length > 0).length;

      collectionStats.push({
        name: collectionName,
        documentCount: docCount,
        subcollectionCount: subcollectionCount,
      });

      totalDocuments += docCount;

      console.log(`   ✅ Exported ${docCount} documents from ${collectionName}`);
    } catch (error) {
      console.error(`   ❌ Error exporting collection ${collectionName}:`, error);
      throw error;
    }
  }

  return { collections: collectionStats, totalDocuments };
}

/**
 * Main backup function
 */
async function backupFirestore(outputDir?: string): Promise<void> {
  try {
    // Initialize Firebase
    initializeFirebase();

    // Get Firestore instance
    const db = admin.firestore();
    const app = admin.app();
    const projectId = app.options.projectId || 'unknown-project';
    // Firestore Admin SDK uses '(default)' database by default
    // For multi-database support, you'd pass databaseId to getFirestore()
    const databaseId = '(default)';

    console.log(`🔐 Project ID: ${projectId}`);
    console.log(`🗄️  Database ID: ${databaseId}`);

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];
    const backupDir = outputDir || path.join(process.cwd(), 'backups', `firestore-backup-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }

    // Export all data
    const { collections, totalDocuments } = await exportAllFirestoreData(db, backupDir);

    // Create backup metadata
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      databaseId: databaseId,
      backupVersion: '1.0.0',
      collections: collections.map(c => c.name),
      totalDocuments: totalDocuments,
    };

    // Save metadata
    const metadataFilePath = path.join(backupDir, 'metadata.json');
    fs.writeFileSync(
      metadataFilePath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Save collection statistics
    const statsFilePath = path.join(backupDir, 'statistics.json');
    fs.writeFileSync(
      statsFilePath,
      JSON.stringify({ collections, totalDocuments }, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`   📁 Backup directory: ${backupDir}`);
    console.log(`   📚 Collections backed up: ${collections.length}`);
    console.log(`   📄 Total documents: ${totalDocuments}`);
    console.log(`   📄 Metadata file: ${metadataFilePath}`);
    console.log(`   📄 Statistics file: ${statsFilePath}`);

    // Print summary
    console.log(`\n📊 Collection Statistics:`);
    for (const stat of collections) {
      console.log(`   ${stat.name}: ${stat.documentCount} documents, ${stat.subcollectionCount} with subcollections`);
    }

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  const outputDir = process.argv[2];
  backupFirestore(outputDir)
    .then(() => {
      console.log('\n✨ Backup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { backupFirestore, exportAllFirestoreData };

