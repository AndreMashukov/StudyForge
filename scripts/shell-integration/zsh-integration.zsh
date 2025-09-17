#!/bin/zsh
# VS Code Shell Integration for Zsh
# Add this line to your ~/.zshrc:
# [[ "$TERM_PROGRAM" == "vscode" ]] && source "$(dirname "${(%):-%x}")/zsh-integration.zsh"

# Check if running in VS Code terminal
if [[ "$TERM_PROGRAM" != "vscode" ]]; then
    return
fi

# Enable VS Code shell integration if available
if command -v code &> /dev/null; then
    # Use automatic integration if available
    if [[ -n "$VSCODE_SHELL_INTEGRATION" ]]; then
        source "$(code --locate-shell-integration-path zsh)" 2>/dev/null || true
    fi
else
    echo "Warning: 'code' command not found. Please ensure VS Code is in your PATH."
fi

# Additional enhancements for the workspace
export CODE_INSIGHTS_AI_ROOT="$(cd "$(dirname "${(%):-%x}")/../.." && pwd)"

# Custom prompt function to show current project context
__code_insights_ai_prompt() {
    if [[ "$PWD" == "$CODE_INSIGHTS_AI_ROOT"* ]]; then
        local relative_path="${PWD#$CODE_INSIGHTS_AI_ROOT}"
        if [[ -z "$relative_path" ]]; then
            relative_path="/"
        fi
        echo -e "%F{cyan}[code-insights-ai:$relative_path]%f "
    fi
}

# Add to prompt
if [[ -n "$PS1" ]] || [[ -n "$ZSH_VERSION" ]]; then
    PROMPT='$(__code_insights_ai_prompt)'$PROMPT
fi

# Nx shortcuts
alias nx='npx nx'
alias nxg='npx nx generate'
alias nxr='npx nx run'
alias nxb='npx nx build'
alias nxt='npx nx test'
alias nxl='npx nx lint'

# Quick navigation aliases
alias cdweb='cd $CODE_INSIGHTS_AI_ROOT/web'
alias cdfunctions='cd $CODE_INSIGHTS_AI_ROOT/functions'
alias cdlibs='cd $CODE_INSIGHTS_AI_ROOT/libs'

# Zsh-specific enhancements
if [[ -n "$ZSH_VERSION" ]]; then
    # Enable command correction
    setopt correct
    
    # Enhanced completion for nx commands
    if command -v nx &> /dev/null; then
        # Simple nx completion
        compdef '_files -g "*.json"' nx
    fi
fi

echo "VS Code Shell Integration for code-insights-ai workspace loaded (zsh)."