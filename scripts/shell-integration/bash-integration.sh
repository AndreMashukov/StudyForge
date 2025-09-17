#!/bin/bash
# VS Code Shell Integration for Bash
# Add this line to your ~/.bashrc:
# [[ "$TERM_PROGRAM" == "vscode" ]] && source "$(dirname "${BASH_SOURCE[0]}")/bash-integration.sh"

# Check if running in VS Code terminal
if [[ "$TERM_PROGRAM" != "vscode" ]]; then
    return
fi

# Enable VS Code shell integration if available
if command -v code &> /dev/null; then
    # Use automatic integration if available
    if [[ -n "$VSCODE_SHELL_INTEGRATION" ]]; then
        source "$(code --locate-shell-integration-path bash)" 2>/dev/null || true
    fi
else
    echo "Warning: 'code' command not found. Please ensure VS Code is in your PATH."
fi

# Additional enhancements for the workspace
export CODE_INSIGHTS_AI_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Custom prompt function to show current project context
__code_insights_ai_prompt() {
    if [[ "$PWD" == "$CODE_INSIGHTS_AI_ROOT"* ]]; then
        local relative_path="${PWD#$CODE_INSIGHTS_AI_ROOT}"
        if [[ -z "$relative_path" ]]; then
            relative_path="/"
        fi
        echo -e "\033[36m[code-insights-ai:$relative_path]\033[0m "
    fi
}

# Add to prompt if PS1 exists
if [[ -n "$PS1" ]]; then
    PS1='$(__code_insights_ai_prompt)'$PS1
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

echo "VS Code Shell Integration for code-insights-ai workspace loaded."