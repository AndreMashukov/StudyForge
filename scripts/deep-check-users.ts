#!/usr/bin/env node
/**
 * Deep Check Firestore Users Collection
 * 
 * This script does a more thorough check of the users collection,
 * including checking for specific document IDs and subcollections.
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

function initializeFirebase(): void {
  if (admin.apps.length === 0) {
    const useEmulator = 
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 
      process.env.FIRESTORE_EMULATOR_HOST;

    if (useEmulator) {
      const projectId = process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || 'demo-code-insights-quiz-ai';
      admin.initializeApp({
        projectId: projectId,
      });
      console.log('✅ Firebase Admin SDK initialized (Emulator mode)');
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin SDK initialized (Production mode)');
    }
  }
}

async function deepCheckUsersCollection(): Promise<void> {
  try {
    initializeFirebase();
    
    const db = admin.firestore();
    
    console.log('\n🔍 Deep checking users collection...\n');
    
    // Check if specific document exists
    const specificUserId = '7TxBd0YOXVyvyESUfN67YeNJpAu4';
    const userRef = db.collection('users').doc(specificUserId);
    const userDoc = await userRef.get();
    
    console.log(`📄 Checking for user document: ${specificUserId}`);
    console.log(`   Exists: ${userDoc.exists ? 'YES ✅' : 'NO ❌'}`);
    
    if (userDoc.exists) {
      console.log(`   Data:`, JSON.stringify(userDoc.data(), null, 2));
      
      // Check for subcollections
      const subcollections = await userRef.listCollections();
      console.log(`   📁 Subcollections: ${subcollections.length}`);
      
      for (const subcol of subcollections) {
        console.log(`      - ${subcol.id}`);
        const subcolSnapshot = await subcol.get();
        console.log(`        Documents: ${subcolSnapshot.size}`);
        
        if (subcol.id === 'rules') {
          subcolSnapshot.forEach(doc => {
            console.log(`          * ${doc.id}`);
          });
        }
      }
    } else {
      console.log(`   ⚠️  Document does not exist in Firestore`);
    }
    
    // Also check all documents in users collection
    console.log('\n📋 All documents in users collection:');
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Total documents: ${usersSnapshot.size}`);
    
    if (usersSnapshot.size === 0) {
      console.log('   ⚠️  Collection is completely empty');
      console.log('\n💡 To fix this:');
      console.log('   1. Create the user document in Firestore');
      console.log('   2. Create the rules subcollection under that user');
      console.log('   3. Run backup again: yarn backup:all');
    } else {
      usersSnapshot.forEach(doc => {
        console.log(`\n   Document ID: ${doc.id}`);
        const data = doc.data();
        console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
        
        // Check subcollections
        doc.ref.listCollections().then(async (subcols) => {
          if (subcols.length > 0) {
            console.log(`   Subcollections: ${subcols.map(sc => sc.id).join(', ')}`);
            for (const subcol of subcols) {
              const subcolSnapshot = await subcol.get();
              console.log(`      - ${subcol.id}: ${subcolSnapshot.size} documents`);
            }
          }
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deepCheckUsersCollection()
  .then(() => {
    console.log('\n✨ Deep check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

