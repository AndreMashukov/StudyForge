# VS Code Shell Integration for Fish
# Add this line to your ~/.config/fish/config.fish:
# string match -q "$TERM_PROGRAM" "vscode"; and source (status dirname)/fish-integration.fish

# Check if running in VS Code terminal
if test "$TERM_PROGRAM" != "vscode"
    return
end

# Enable VS Code shell integration if available
if command -v code > /dev/null 2>&1
    # Use automatic integration if available
    if test -n "$VSCODE_SHELL_INTEGRATION"
        source (code --locate-shell-integration-path fish) 2>/dev/null; or true
    end
else
    echo "Warning: 'code' command not found. Please ensure VS Code is in your PATH."
end

# Set workspace root
set -gx CODE_INSIGHTS_AI_ROOT (cd (dirname (status --current-filename))/../..; and pwd)

# Custom prompt function to show current project context
function __code_insights_ai_prompt
    if string match -q "$CODE_INSIGHTS_AI_ROOT*" "$PWD"
        set relative_path (string replace "$CODE_INSIGHTS_AI_ROOT" "" "$PWD")
        if test -z "$relative_path"
            set relative_path "/"
        end
        echo -n (set_color cyan)"[code-insights-ai:$relative_path]"(set_color normal)" "
    end
end

# Add to prompt
function fish_prompt
    __code_insights_ai_prompt
    # Fallback to default prompt if no other prompt is defined
    if not functions -q __original_fish_prompt
        echo -n (prompt_pwd)"> "
    else
        __original_fish_prompt
    end
end

# Nx shortcuts
function nx
    npx nx $argv
end

function nxg
    npx nx generate $argv
end

function nxr
    npx nx run $argv
end

function nxb
    npx nx build $argv
end

function nxt
    npx nx test $argv
end

function nxl
    npx nx lint $argv
end

# Quick navigation aliases
function cdweb
    cd $CODE_INSIGHTS_AI_ROOT/web
end

function cdfunctions
    cd $CODE_INSIGHTS_AI_ROOT/functions
end

function cdlibs
    cd $CODE_INSIGHTS_AI_ROOT/libs
end

# Fish-specific enhancements
# Enable command suggestions
set -g fish_autosuggestion_enabled 1

# Custom completions for nx (basic)
complete -c nx -f -a "build test lint serve deploy"

echo "VS Code Shell Integration for code-insights-ai workspace loaded (fish)."