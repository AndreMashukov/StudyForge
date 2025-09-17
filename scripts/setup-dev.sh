#!/bin/bash

# Setup Development Environment Script
# This script sets up the local development environment for Code Insights AI

set -e  # Exit on error

echo "🚀 Setting up Code Insights AI Development Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Check if Yarn is installed
if ! command -v yarn &> /dev/null; then
    echo -e "${YELLOW}⚠️  Yarn not found. Installing Yarn...${NC}"
    npm install -g yarn
fi

echo -e "${GREEN}✅ Yarn $(yarn -v) detected${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
yarn install

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Firebase CLI not found. Installing...${NC}"
    npm install -g firebase-tools
fi

echo -e "${GREEN}✅ Firebase CLI $(firebase --version | head -n1) detected${NC}"

# Login to Firebase (if not already logged in)
echo -e "${BLUE}🔐 Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Firebase. Please login...${NC}"
    firebase login
else
    echo -e "${GREEN}✅ Firebase authentication verified${NC}"
fi

# Initialize Firebase project (if not already done)
if [ ! -f "firebase.json" ]; then
    echo -e "${BLUE}🔥 Initializing Firebase project...${NC}"
    firebase init
else
    echo -e "${GREEN}✅ Firebase project already initialized${NC}"
fi

# Create local environment file if it doesn't exist
if [ ! -f "web/.env.local" ]; then
    echo -e "${BLUE}🔧 Creating local environment file...${NC}"
    cat > web/.env.local << EOF
# Local Development Environment Variables
# These are used when running the app locally with Firebase Emulators

# Firebase Emulator Configuration
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=demo-project
VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:demo-app-id

# Gemini API Key (replace with your actual development key)
VITE_GEMINI_API_KEY=your-gemini-api-key-here

# Environment indicator
VITE_ENVIRONMENT=development
EOF
    echo -e "${YELLOW}⚠️  Created web/.env.local - Please update VITE_GEMINI_API_KEY with your actual API key${NC}"
else
    echo -e "${GREEN}✅ Local environment file already exists${NC}"
fi

# Create functions environment file if it doesn't exist
if [ ! -f "functions/.env.local" ]; then
    echo -e "${BLUE}🔧 Creating functions environment file...${NC}"
    cat > functions/.env.local << EOF
# Firebase Functions Local Environment Variables
# For production, use: firebase functions:config:set gemini.api_key="your-key"

# Gemini API Key (replace with your actual development key)
GEMINI_API_KEY=your-gemini-api-key-here

# Environment indicator
NODE_ENV=development
EOF
    echo -e "${YELLOW}⚠️  Created functions/.env.local - Please update GEMINI_API_KEY with your actual API key${NC}"
else
    echo -e "${GREEN}✅ Functions environment file already exists${NC}"
fi

# Install Firebase emulators
echo -e "${BLUE}🧪 Setting up Firebase Emulators...${NC}"
firebase setup:emulators:database
firebase setup:emulators:firestore
firebase setup:emulators:pubsub
firebase setup:emulators:storage
firebase setup:emulators:ui

# Build the project to check everything works
echo -e "${BLUE}🏗️  Building project to verify setup...${NC}"
yarn nx build web
yarn nx build functions

echo -e "${GREEN}✅ Build successful!${NC}"

# Display next steps
echo ""
echo -e "${GREEN}🎉 Development Environment Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update API keys in the .env.local files:"
echo "   - web/.env.local: Update VITE_GEMINI_API_KEY"
echo "   - functions/.env.local: Update GEMINI_API_KEY"
echo ""
echo -e "${BLUE}To start development:${NC}"
echo "1. Start Firebase Emulators:"
echo "   ${GREEN}firebase emulators:start${NC}"
echo ""
echo "2. In another terminal, start the web app:"
echo "   ${GREEN}yarn nx serve web${NC}"
echo ""
echo "3. Access your app:"
echo "   - Web App: http://localhost:4200"
echo "   - Firebase Emulator UI: http://localhost:4000"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "- Run tests: ${GREEN}yarn nx test web${NC}"
echo "- Run lint: ${GREEN}yarn nx lint web${NC}"
echo "- Build for production: ${GREEN}yarn nx build web --configuration=production${NC}"
echo "- Deploy to production: ${GREEN}firebase deploy${NC}"
echo ""
echo -e "${YELLOW}Note: Make sure to get your Gemini API key from Google AI Studio and update the .env.local files${NC}"