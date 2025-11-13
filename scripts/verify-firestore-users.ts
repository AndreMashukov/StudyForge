#!/usr/bin/env node
/**
 * Verify Firestore Users Collection
 * 
 * This script checks what's actually in the Firestore users collection
 * and verifies the backup script can see it.
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

function initializeFirebase(): void {
  if (admin.apps.length === 0) {
    // Check if we're using emulators
    const useEmulator = 
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 
      process.env.FIRESTORE_EMULATOR_HOST;

    if (useEmulator) {
      // Emulator mode - no credentials needed
      const projectId = process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || 'demo-code-insights-quiz-ai';
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
    
    console.log('\n🔍 Checking Firestore collections...\n');
    
    // List all collections
    const collections = await db.listCollections();
    console.log(`📚 Found ${collections.length} top-level collections:`);
    collections.forEach(col => {
      console.log(`   - ${col.id}`);
    });
    
    // Check users collection specifically
    console.log('\n🔍 Checking users collection...\n');
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    console.log(`📄 Users collection has ${usersSnapshot.size} documents`);
    
    if (usersSnapshot.size === 0) {
      console.log('⚠️  Users collection is empty!');
      console.log('   This explains why users.json is empty in the backup.');
    } else {
      console.log('\n📋 User documents:');
      usersSnapshot.forEach(doc => {
        console.log(`\n   Document ID: ${doc.id}`);
        console.log(`   Data:`, JSON.stringify(doc.data(), null, 2));
        
        // Check for subcollections
        doc.ref.listCollections().then(subcollections => {
          if (subcollections.length > 0) {
            console.log(`   📁 Subcollections: ${subcollections.map(sc => sc.id).join(', ')}`);
            
            // Check rules subcollection specifically
            const rulesRef = doc.ref.collection('rules');
            rulesRef.get().then(rulesSnapshot => {
              console.log(`      - rules: ${rulesSnapshot.size} documents`);
              if (rulesSnapshot.size > 0) {
                rulesSnapshot.forEach(ruleDoc => {
                  console.log(`        * ${ruleDoc.id}`);
                });
              }
            });
          } else {
            console.log(`   📁 No subcollections`);
          }
        });
      });
    }
    
    // Verify listCollections sees it
    const hasUsersCollection = collections.some(col => col.id === 'users');
    console.log(`\n✅ listCollections() sees users collection: ${hasUsersCollection ? 'YES' : 'NO'}`);
    
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

