// Test script to call the deployed generateQuiz function 
// This properly uses the Firebase callable function format

// Load environment variables from workspace root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase config using NX workspace environment variables
const firebaseConfig = {
  projectId: process.env.NX_PUBLIC_FIREBASE_PROJECT_ID || "demo-project-id",
  authDomain: process.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  storageBucket: process.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.firebasestorage.app",
  messagingSenderId: process.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NX_PUBLIC_FIREBASE_APP_ID || "demo-app-id"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, process.env.NX_FIREBASE_REGION || 'asia-east1');

async function testGenerateQuiz() {
  try {
    console.log('Testing generateQuiz function with AWS URL...');
    
    const generateQuizFunction = httpsCallable(functions, 'generateQuiz');
    
    const result = await generateQuizFunction({
      url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html'
    });
    
    console.log('Full result:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.data) {
      console.log('Success! Quiz generated:');
      console.log('Quiz ID:', result.data.data.quizId);
      console.log('Quiz title:', result.data.data.quiz.title);
      console.log('Number of questions:', result.data.data.quiz.questions.length);
    } else {
      console.log('Unexpected response structure');
    }
    
  } catch (error) {
    console.error('Error calling generateQuiz:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
  }
}

testGenerateQuiz();