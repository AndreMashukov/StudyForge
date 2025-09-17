#!/usr/bin/env node

/**
 * Test script for Firebase Functions using the emulator
 * Run with: node test-functions.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'code-insights-quiz-ai',
});

async function testHealthCheck() {
  console.log('\n🧪 Testing Health Check...');
  
  try {
    const response = await fetch('http://127.0.0.1:5001/code-insights-quiz-ai/us-central1/healthCheck');
    const data = await response.json();
    
    console.log('✅ Health Check Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Health Check Error:', error.message);
  }
}

async function testGenerateQuiz() {
  console.log('\n🧪 Testing Generate Quiz...');
  
  try {
    // Test with a simple article URL
    const testUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    
    const response = await fetch('http://127.0.0.1:5001/code-insights-quiz-ai/us-central1/generateQuiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { url: testUrl }
      }),
    });
    
    const data = await response.json();
    console.log('✅ Generate Quiz Response:', JSON.stringify(data.result, null, 2));
    
    if (data.result && data.result.success && data.result.data) {
      return data.result.data.quizId;
    }
    
  } catch (error) {
    console.error('❌ Generate Quiz Error:', error.message);
  }
  
  return null;
}

async function testGetQuiz(quizId) {
  if (!quizId) {
    console.log('⏭️  Skipping Get Quiz test - no quiz ID available');
    return;
  }
  
  console.log('\n🧪 Testing Get Quiz...');
  
  try {
    const response = await fetch('http://127.0.0.1:5001/code-insights-quiz-ai/us-central1/getQuiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { quizId }
      }),
    });
    
    const data = await response.json();
    console.log('✅ Get Quiz Response:', JSON.stringify(data.result, null, 2));
    
  } catch (error) {
    console.error('❌ Get Quiz Error:', error.message);
  }
}

async function testGetRecentQuizzes() {
  console.log('\n🧪 Testing Get Recent Quizzes...');
  
  try {
    const response = await fetch('http://127.0.0.1:5001/code-insights-quiz-ai/us-central1/getRecentQuizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { limit: 5 }
      }),
    });
    
    const data = await response.json();
    console.log('✅ Get Recent Quizzes Response:', JSON.stringify(data.result, null, 2));
    
  } catch (error) {
    console.error('❌ Get Recent Quizzes Error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Firebase Functions Tests...');
  console.log('📍 Using Firebase Emulators:');
  console.log('   - Functions: http://127.0.0.1:5001');
  console.log('   - Firestore: http://127.0.0.1:8080');
  console.log('   - Auth: http://127.0.0.1:9099');
  console.log('   - UI: http://127.0.0.1:4000');
  
  // Run tests sequentially
  await testHealthCheck();
  
  const quizId = await testGenerateQuiz();
  
  await testGetQuiz(quizId);
  
  await testGetRecentQuizzes();
  
  console.log('\n✨ All tests completed!');
  console.log('\n📱 You can also test using the Firebase Emulator UI:');
  console.log('   http://127.0.0.1:4000/functions');
}

// Global fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Run the tests
runTests().catch(console.error);