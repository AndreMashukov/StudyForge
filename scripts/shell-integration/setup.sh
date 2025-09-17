#!/bin/bash
# VS Code Shell Integration Setup Script
# This script helps users set up shell integration for the code-insights-ai workspace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the absolute path to the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}Setting up VS Code Shell Integration for code-insights-ai${NC}"
echo "Workspace: $WORKSPACE_ROOT"
echo

# Function to detect shell
detect_shell() {
    if [[ -n "$ZSH_VERSION" ]]; then
        echo "zsh"
    elif [[ -n "$BASH_VERSION" ]]; then
        echo "bash"
    elif [[ -n "$FISH_VERSION" ]]; then
        echo "fish"
    elif [[ "$0" == *"pwsh"* ]] || [[ "$0" == *"powershell"* ]]; then
        echo "powershell"
    else
        echo "unknown"
    fi
}

# Function to get shell config file
get_shell_config() {
    local shell_type="$1"
    case "$shell_type" in
        bash)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        zsh)
            echo "$HOME/.zshrc"
            ;;
        fish)
            echo "$HOME/.config/fish/config.fish"
            ;;
        powershell)
            # This will be handled differently
            echo "PowerShell profile"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to add integration to shell config
add_to_shell_config() {
    local shell_type="$1"
    local config_file="$2"
    local integration_script=""
    local source_line=""

    case "$shell_type" in
        bash)
            integration_script="$SCRIPT_DIR/bash-integration.sh"
            source_line="[[ \"\$TERM_PROGRAM\" == \"vscode\" ]] && source \"$integration_script\""
            ;;
        zsh)
            integration_script="$SCRIPT_DIR/zsh-integration.zsh"
            source_line="[[ \"\$TERM_PROGRAM\" == \"vscode\" ]] && source \"$integration_script\""
            ;;
        fish)
            integration_script="$SCRIPT_DIR/fish-integration.fish"
            source_line="string match -q \"\$TERM_PROGRAM\" \"vscode\"; and source \"$integration_script\""
            # Ensure fish config directory exists
            mkdir -p "$(dirname "$config_file")"
            ;;
        *)
            echo -e "${RED}Unsupported shell type: $shell_type${NC}"
            return 1
            ;;
    esac

    # Check if already added
    if [[ -f "$config_file" ]] && grep -Fq "$integration_script" "$config_file"; then
        echo -e "${YELLOW}Integration already exists in $config_file${NC}"
        return 0
    fi

    # Add the integration line
    echo "" >> "$config_file"
    echo "# VS Code Shell Integration for code-insights-ai" >> "$config_file"
    echo "$source_line" >> "$config_file"
    
    echo -e "${GREEN}Added integration to $config_file${NC}"
}

# Function to setup PowerShell integration
setup_powershell_integration() {
    echo -e "${BLUE}PowerShell Integration Setup${NC}"
    echo "For PowerShell, you need to manually add the following line to your PowerShell profile:"
    echo
    echo -e "${YELLOW}if (\$env:TERM_PROGRAM -eq \"vscode\") { . \"$SCRIPT_DIR/powershell-integration.ps1\" }${NC}"
    echo
    echo "To find your PowerShell profile location, run:"
    echo -e "${YELLOW}\$PROFILE${NC}"
    echo
    echo "To edit your profile, run:"
    echo -e "${YELLOW}code \$PROFILE${NC}"
}

# Main setup function
main() {
    local current_shell
    current_shell=$(detect_shell)
    
    echo "Detected shell: $current_shell"
    
    if [[ "$current_shell" == "unknown" ]]; then
        echo -e "${YELLOW}Could not detect shell automatically.${NC}"
        echo "Please choose your shell:"
        echo "1) bash"
        echo "2) zsh"
        echo "3) fish"
        echo "4) PowerShell"
        read -p "Enter choice (1-4): " choice
        
        case "$choice" in
            1) current_shell="bash" ;;
            2) current_shell="zsh" ;;
            3) current_shell="fish" ;;
            4) current_shell="powershell" ;;
            *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
        esac
    fi
    
    if [[ "$current_shell" == "powershell" ]]; then
        setup_powershell_integration
        return 0
    fi
    
    local config_file
    config_file=$(get_shell_config "$current_shell")
    
    if [[ -z "$config_file" ]]; then
        echo -e "${RED}Could not determine config file for shell: $current_shell${NC}"
        exit 1
    fi
    
    echo "Shell config file: $config_file"
    
    # Ask for confirmation
    read -p "Add shell integration to $config_file? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        add_to_shell_config "$current_shell" "$config_file"
        echo
        echo -e "${GREEN}Shell integration setup complete!${NC}"
        echo -e "${BLUE}Please restart your terminal or run:${NC}"
        echo -e "${YELLOW}source $config_file${NC}"
    else
        echo "Setup cancelled."
        echo
        echo "To manually set up integration, add this line to your $config_file:"
        case "$current_shell" in
            bash|zsh)
                echo -e "${YELLOW}[[ \"\$TERM_PROGRAM\" == \"vscode\" ]] && source \"$SCRIPT_DIR/${current_shell}-integration.${current_shell}\"${NC}"
                ;;
            fish)
                echo -e "${YELLOW}string match -q \"\$TERM_PROGRAM\" \"vscode\"; and source \"$SCRIPT_DIR/fish-integration.fish\"${NC}"
                ;;
        esac
    fi
}

# Check if VS Code is available
if ! command -v code &> /dev/null; then
    echo -e "${RED}ERROR: 'code' command not found in PATH.${NC}"
    echo -e "${YELLOW}VS Code shell integration requires the 'code' command to be available.${NC}"
    echo
    echo "To install it:"
    echo "1. Open VS Code"
    echo "2. Press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)"
    echo "3. Type 'Shell Command: Install code command in PATH'"
    echo "4. Press Enter and follow the prompts"
    echo
    echo "After installing the 'code' command, you can run:"
    echo -e "${YELLOW}./scripts/shell-integration/install-vscode-integration.sh${NC}"
    echo
    echo "Or run this script again."
    exit 1
fi

# Run main setup
main "$@"