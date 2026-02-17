#!/usr/bin/env bash
set -euo pipefail

# Use current directory (where the command is run from), not script location
# This allows the script to initialize any worktree directory
ROOT_DIR="$(pwd)"

echo "=========================================="
echo "Setting up code-insights-ai worktree..."
echo "Working directory: $ROOT_DIR"
echo "=========================================="

# Verify we're in a git repository
if [[ ! -d ".git" && ! -f ".git" ]]; then
  echo "❌ ERROR: Not in a git repository root directory"
  echo "Please run this script from the root of your worktree"
  exit 1
fi

# Find the main worktree directory (where env.dev is located)
MAIN_WORKTREE="/Users/andreymashukov/Desktop/projects/code-insights-ai"
if [[ ! -f "$MAIN_WORKTREE/env.dev" ]]; then
  echo "⚠️  Warning: env.dev not found in main worktree at $MAIN_WORKTREE"
  echo "Falling back to .env.example if available"
  MAIN_WORKTREE=""
fi

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ ERROR: Node.js is not installed or not on PATH."
  echo "Install Node.js (LTS recommended) and rerun this script."
  exit 1
fi
echo "✅ Node.js $(node --version) detected"

# Check/enable Yarn
if ! command -v yarn >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "🔧 Enabling Yarn via Corepack..."
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v yarn >/dev/null 2>&1; then
  echo "❌ ERROR: Yarn is not installed or not on PATH."
  echo "Install Yarn or enable Corepack, then rerun this script."
  exit 1
fi
echo "✅ Yarn $(yarn --version) detected"

# Initialize environment variables
echo ""
echo "📝 Initializing environment variables..."

# Check if .env exists, if not create from main worktree's env.dev
if [[ ! -f .env ]]; then
  if [[ -n "$MAIN_WORKTREE" && -f "$MAIN_WORKTREE/env.dev" ]]; then
    cp "$MAIN_WORKTREE/env.dev" .env
    echo "✅ Created .env from $MAIN_WORKTREE/env.dev"
  elif [[ -f .env.example ]]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
  else
    echo "❌ ERROR: No env.dev or .env.example found"
    echo "Cannot create .env file. Please ensure env.dev exists in main worktree."
    exit 1
  fi
else
  echo "✅ .env already exists"
fi

# Check if .env.local exists, if not create from main worktree's env.dev
if [[ ! -f .env.local ]]; then
  if [[ -n "$MAIN_WORKTREE" && -f "$MAIN_WORKTREE/env.dev" ]]; then
    cp "$MAIN_WORKTREE/env.dev" .env.local
    echo "✅ Created .env.local from $MAIN_WORKTREE/env.dev"
    echo "⚠️  Remember to update values as needed for local development"
  elif [[ -f .env.example ]]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from .env.example"
    echo "⚠️  Remember to update values as needed for local development"
  elif [[ -f .env ]]; then
    cp .env .env.local
    echo "✅ Created .env.local from .env"
  fi
else
  echo "✅ .env.local already exists"
fi

# Install dependencies with Yarn
echo ""
echo "📦 Installing dependencies..."
if [[ ! -d node_modules ]]; then
  echo "Running yarn install..."
  yarn install --frozen-lockfile
  echo "✅ Dependencies installed successfully"
else
  echo "⚠️  node_modules already exists"
  echo "Running yarn install to ensure dependencies are up to date..."
  yarn install --frozen-lockfile
  echo "✅ Dependencies verified and updated"
fi

# Warm up Nx and build cache (best-effort for Codex)
echo ""
echo "🔧 Warming up Nx workspace..."
if yarn nx --version >/dev/null 2>&1; then
  echo "✅ Nx $(yarn nx --version 2>/dev/null) detected"
  
  # Show projects to initialize Nx graph
  yarn nx show projects >/dev/null 2>&1 || true
  
  # Generate project graph for Codex indexing (best-effort)
  yarn nx graph --file=.nx/workspace-graph.json >/dev/null 2>&1 || true
  
  echo "✅ Nx workspace initialized"
else
  echo "⚠️  Nx not available, skipping workspace initialization"
fi

# Check for additional worktree-specific setup
if [[ -f "web/.env.local" ]]; then
  echo "✅ Web app environment configured"
else
  echo "⚠️  Consider creating web/.env.local if needed for web-specific vars"
fi

if [[ -f "functions/.env" ]]; then
  echo "✅ Functions environment configured"
else
  echo "⚠️  Consider creating functions/.env if needed for function-specific vars"
fi

echo ""
echo "=========================================="
echo "✅ Worktree setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review and update .env and .env.local with your actual values"
echo "  2. Start Firebase emulators: firebase emulators:start"
echo "  3. Start development server: nx serve web"
echo "  4. Open Cursor/Codex and let it index the workspace"
echo ""
