#!/usr/bin/env node
/**
 * Verify Firestore Users Collection (User-Scoped Structure)
 * 
 * This script verifies the user-scoped Firestore structure:
 *   - users/{userId}/documents
 *   - users/{userId}/quizzes
 *   - users/{userId}/directories
 *   - users/{userId}/rules
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

// Expected subcollections under each user document
const EXPECTED_SUBCOLLECTIONS = ['documents', 'quizzes', 'directories', 'rules'];

function initializeFirebase(): void {
  if (admin.apps.length === 0) {
    // Check if we're using emulators
    const useEmulator = 
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 
      process.env.FIRESTORE_EMULATOR_HOST;

    if (useEmulator) {
      // Emulator mode - no credentials needed
      const projectId = process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || 'demo-[REDACTED]';
      admin.initializeApp({
        projectId: projectId,
      });
      console.log('✅ Firebase Admin SDK initialized (Emulator mode)');
    } else {
      // Production mode - need credentials
      admin.initializeApp();
      console.log('✅ Firebase Admin SDK initialized (Production mode)');
    }
  }
}

async function verifyUsersCollection(): Promise<void> {
  try {
    initializeFirebase();
    
    const db = admin.firestore();
    
    console.log('\n🔍 Verifying user-scoped Firestore structure...\n');
    console.log(`   Expected structure: users/{userId}/{${EXPECTED_SUBCOLLECTIONS.join(', ')}}\n`);
    
    // List all collections
    const collections = await db.listCollections();
    console.log(`📚 Found ${collections.length} top-level collection(s):`);
    collections.forEach(col => {
      console.log(`   - ${col.id}`);
    });
    
    // Verify users collection exists
    const hasUsersCollection = collections.some(col => col.id === 'users');
    console.log(`\n✅ listCollections() sees users collection: ${hasUsersCollection ? 'YES' : 'NO'}`);
    
    // Check users collection
    console.log('\n🔍 Checking users collection...\n');
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    console.log(`👤 Users collection has ${usersSnapshot.size} document(s)`);
    
    if (usersSnapshot.size === 0) {
      console.log('⚠️  Users collection is empty!');
      console.log('   No user-scoped data to verify.');
      return;
    }
    
    // Verify each user's subcollections
    console.log('\n📋 User documents and subcollections:\n');
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      console.log(`   👤 User: ${userId}`);
      
      if (Object.keys(userData).length > 0) {
        console.log(`      Profile fields: ${Object.keys(userData).join(', ')}`);
      } else {
        console.log(`      Profile data: (empty - container document)`);
      }
      
      // List actual subcollections
      const subcollections = await userDoc.ref.listCollections();
      const subcollectionNames = subcollections.map(sc => sc.id);
      console.log(`      📁 Subcollections found: ${subcollectionNames.length > 0 ? subcollectionNames.join(', ') : 'none'}`);
      
      // Check each expected subcollection
      for (const expectedSubcol of EXPECTED_SUBCOLLECTIONS) {
        const subcolRef = userDoc.ref.collection(expectedSubcol);
        const subcolSnapshot = await subcolRef.get();
        const exists = subcollectionNames.includes(expectedSubcol);
        const icon = exists ? '✅' : '⚠️';
        
        console.log(`         ${icon} ${expectedSubcol}: ${subcolSnapshot.size} document(s)`);
        
        // Show first few document IDs as a preview
        if (subcolSnapshot.size > 0) {
          const previewDocs = subcolSnapshot.docs.slice(0, 3);
          for (const doc of previewDocs) {
            console.log(`            • ${doc.id}`);
          }
          if (subcolSnapshot.size > 3) {
            console.log(`            ... and ${subcolSnapshot.size - 3} more`);
          }
        }
      }
      
      // Check for unexpected subcollections
      const unexpectedSubcols = subcollectionNames.filter(name => !EXPECTED_SUBCOLLECTIONS.includes(name));
      if (unexpectedSubcols.length > 0) {
        console.log(`      ⚠️  Unexpected subcollections: ${unexpectedSubcols.join(', ')}`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Users: ${usersSnapshot.size}`);
    
    let totalDocs = 0;
    for (const userDoc of usersSnapshot.docs) {
      for (const subcolName of EXPECTED_SUBCOLLECTIONS) {
        const subcolSnapshot = await userDoc.ref.collection(subcolName).get();
        totalDocs += subcolSnapshot.size;
      }
    }
    console.log(`   Total documents across all subcollections: ${totalDocs}`);
    
    if (!hasUsersCollection && usersSnapshot.size > 0) {
      console.log('\n⚠️  WARNING: Users collection has documents but listCollections() did not return it!');
      console.log('   This might be a Firestore emulator issue.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyUsersCollection()
  .then(() => {
    console.log('\n✨ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });


