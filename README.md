# code-insights-ai

AI-powered code insights and analysis platform built with modern web technologies.

> **Status:** ✅ Firebase Functions deployment permissions fixed - Testing in progress

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up VS Code Shell Integration (Recommended):**
   ```bash
   npm run setup-shell-integration
   ```
   Or use the Nx command:
   ```bash
   nx run shell-integration:setup
   ```

3. **Start development:**
   ```bash
   nx serve web
   ```

## Development Tools

### VS Code Shell Integration

This workspace includes enhanced VS Code terminal integration that provides:

- **Command decorations** with success/failure indicators
- **Command navigation** (Ctrl/Cmd+Up/Down between commands)
- **Directory detection** for enhanced file linking
- **Terminal IntelliSense** with autocomplete
- **Project-aware prompts** showing your current location
- **Nx command shortcuts** (e.g., `nxb` for build, `nxt` for test)
- **Quick navigation** (`cdweb`, `cdfunctions`, `cdlibs`)

See [Shell Integration Setup](./scripts/shell-integration/README.md) for detailed instructions.

### Available Commands

- `nx serve web` - Start the web development server  
- `nx build web` - Build the web application
- `nx test web` - Run web application tests
- `nx serve functions` - Start the Firebase functions locally
- `nx build functions` - Build Firebase functions
- `nx run shell-integration:setup` - Set up enhanced terminal integration
- `nx run shell-integration:status` - Check shell integration status

## 🔧 Deployment Status
- ✅ Firebase project configured and connected
- ✅ GitHub Actions deployment: **WEB APP ONLY**
  - ✅ Firebase Hosting deployment configured
  - 🚫 Firebase Functions deployment **REMOVED** (permission issues)
  - Simplified to hosting-only pipeline for reliable deployment
- ✅ NX monorepo integration working correctly
- ✅ Build artifacts verified and functioning
- 🚀 **Ready for web app deployment** - Clean hosting-only pipeline