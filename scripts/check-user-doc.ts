#!/usr/bin/env node
/**
 * Check User Document with Subcollections
 * 
 * This script specifically checks for the user document and its subcollections
 * even if the document has no fields.
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
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080'}`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin SDK initialized (Production mode)');
    }
  }
}

async function checkUserDocument(): Promise<void> {
  try {
    initializeFirebase();
    
    const db = admin.firestore();
    const userId = '7TxBd0YOXVyvyESUfN67YeNJpAu4';
    const userRef = db.collection('users').doc(userId);
    
    console.log(`\n🔍 Checking user document: ${userId}\n`);
    
    // Method 1: Direct document get
    const userDoc = await userRef.get();
    console.log(`📄 Direct get(): ${userDoc.exists ? 'EXISTS ✅' : 'NOT FOUND ❌'}`);
    
    if (userDoc.exists) {
      const data = userDoc.data();
      console.log(`   Data fields: ${data ? Object.keys(data).length : 0}`);
      if (data && Object.keys(data).length > 0) {
        console.log(`   Fields: ${Object.keys(data).join(', ')}`);
      } else {
        console.log(`   ⚠️  Document has no fields (empty document)`);
      }
    }
    
    // Method 2: Check via collection query
    console.log(`\n📋 Checking via collection query:`);
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Total documents in collection: ${usersSnapshot.size}`);
    
    if (usersSnapshot.size > 0) {
      usersSnapshot.forEach(doc => {
        console.log(`   - Document ID: ${doc.id}`);
        const data = doc.data();
        console.log(`     Fields: ${data ? Object.keys(data).length : 0}`);
      });
    }
    
    // Method 3: Check subcollections directly (even if parent doc doesn't exist)
    console.log(`\n📁 Checking subcollections directly:`);
    const subcollections = await userRef.listCollections();
    console.log(`   Subcollections found: ${subcollections.length}`);
    
    if (subcollections.length > 0) {
      for (const subcol of subcollections) {
        console.log(`   - ${subcol.id}`);
        const subcolSnapshot = await subcol.get();
        console.log(`     Documents: ${subcolSnapshot.size}`);
        
        if (subcol.id === 'rules') {
          subcolSnapshot.forEach(doc => {
            console.log(`       * ${doc.id}`);
            const data = doc.data();
            console.log(`         Fields: ${Object.keys(data).join(', ')}`);
          });
        }
      }
    } else {
      console.log(`   ⚠️  No subcollections found`);
    }
    
    // Method 4: Try to create an empty document and then check
    console.log(`\n💡 Testing: If document has no fields, it might not appear in queries`);
    console.log(`   But subcollections should still be accessible via listCollections()`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserDocument()
  .then(() => {
    console.log('\n✨ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

