#!/bin/bash
# Script to add VS Code shell integration to ~/.zshrc

ZSHRC_FILE="$HOME/.zshrc"
INTEGRATION_LINE='[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"'

echo "🔧 VS Code Shell Integration Setup"
echo "=================================="
echo

# Check if code command exists
if ! command -v code &> /dev/null; then
    echo "❌ Error: 'code' command not found in PATH"
    echo ""
    echo "Please install it first:"
    echo "1. Open VS Code"
    echo "2. Press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)"
    echo "3. Type: Shell Command: Install 'code' command in PATH"
    echo "4. Press Enter"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ 'code' command found in PATH"

# Test if we can get the integration path
INTEGRATION_PATH=$(code --locate-shell-integration-path zsh 2>/dev/null)
if [[ -z "$INTEGRATION_PATH" ]]; then
    echo "❌ Error: Could not locate VS Code shell integration script"
    echo "Make sure you have a recent version of VS Code installed."
    exit 1
fi

echo "✅ VS Code shell integration script found at: $INTEGRATION_PATH"

# Check if already added
if [[ -f "$ZSHRC_FILE" ]] && grep -Fq "code --locate-shell-integration-path zsh" "$ZSHRC_FILE"; then
    echo "⚠️  Shell integration already exists in $ZSHRC_FILE"
    echo ""
    echo "To reload it, run: source ~/.zshrc"
    exit 0
fi

# Add the integration
echo ""
echo "Adding shell integration to $ZSHRC_FILE..."

# Backup the original file
cp "$ZSHRC_FILE" "$ZSHRC_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup created: $ZSHRC_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Add the integration line
echo "" >> "$ZSHRC_FILE"
echo "# VS Code shell integration" >> "$ZSHRC_FILE"
echo "$INTEGRATION_LINE" >> "$ZSHRC_FILE"

echo "✅ Shell integration added to $ZSHRC_FILE"
echo ""
echo "🎉 Setup complete! Now run:"
echo "   source ~/.zshrc"
echo ""
echo "Or restart your terminal to activate shell integration."
echo ""
echo "You can verify it's working by checking:"
echo "   echo \$VSCODE_SHELL_INTEGRATION"
echo ""
echo "It should show a path to the VS Code integration script."