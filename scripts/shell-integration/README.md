# VS Code Shell Integration Setup

This directory contains VS Code shell integration setup for the `code-insights-ai` workspace. Shell integration enhances your terminal experience with features like command decorations, navigation, directory detection, and IntelliSense.

## Features

- **Command Decorations**: Visual indicators showing command success/failure status
- **Command Navigation**: Navigate between commands with Ctrl/Cmd+Up/Down
- **Working Directory Detection**: Enhanced file link resolution and terminal tab labels
- **Sticky Scroll**: Keep commands visible when scrolling through output
- **Terminal IntelliSense**: Autocomplete for commands, files, and arguments
- **Quick Fixes**: Smart suggestions for common command errors
- **Command History**: Enhanced command history with fuzzy search

## Quick Setup

### Automatic Setup (Recommended)

Run the setup script from VS Code's integrated terminal:

```bash
./scripts/shell-integration/setup.sh
```

Or use the VS Code task:
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Tasks: Run Task"
3. Select "Setup Shell Integration"

### Manual Setup

Choose your shell and follow the appropriate instructions:

#### Bash

Add to your `~/.bashrc` (Linux) or `~/.bash_profile` (macOS):

```bash
[[ "$TERM_PROGRAM" == "vscode" ]] && source "/path/to/code-insights-ai/scripts/shell-integration/bash-integration.sh"
```

#### Zsh

Add to your `~/.zshrc`:

```zsh
[[ "$TERM_PROGRAM" == "vscode" ]] && source "/path/to/code-insights-ai/scripts/shell-integration/zsh-integration.zsh"
```

#### Fish

Add to your `~/.config/fish/config.fish`:

```fish
string match -q "$TERM_PROGRAM" "vscode"; and source "/path/to/code-insights-ai/scripts/shell-integration/fish-integration.fish"
```

#### PowerShell

Add to your PowerShell profile (find location with `$PROFILE`):

```powershell
if ($env:TERM_PROGRAM -eq "vscode") { . "/path/to/code-insights-ai/scripts/shell-integration/powershell-integration.ps1" }
```

## Workspace Features

The integration scripts provide additional workspace-specific features:

### Project Context Prompt
Shows the current location within the project:
```
[code-insights-ai:/web] $ npm run dev
[code-insights-ai:/functions] $ nx build
```

### Nx Shortcuts
- `nx` - Run any Nx command
- `nxg` - Generate with Nx (`nx generate`)
- `nxr` - Run Nx target (`nx run`)
- `nxb` - Build project (`nx build`)
- `nxt` - Test project (`nx test`)
- `nxl` - Lint project (`nx lint`)

### Quick Navigation
- `cdweb` - Navigate to web app
- `cdfunctions` - Navigate to functions
- `cdlibs` - Navigate to shared libraries

## Shell Integration Quality

VS Code displays the shell integration quality in the terminal tab tooltip:

- **Rich**: Full integration with all features working
- **Basic**: Partial integration, some features may be limited
- **None**: No integration active

## Troubleshooting

### VS Code Command Not Found

If you see "'code' command not found":

1. Open VS Code
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Shell Command: Install 'code' command in PATH"
4. Follow the instructions

### Integration Not Working

1. Restart your terminal or reload your shell config:
   ```bash
   source ~/.bashrc  # or ~/.zshrc, etc.
   ```

2. Check if you're in a VS Code terminal:
   ```bash
   echo $TERM_PROGRAM  # should show "vscode"
   ```

3. Verify VS Code shell integration is enabled:
   - Open VS Code Settings
   - Search for "terminal.integrated.shellIntegration.enabled"
   - Ensure it's set to `true`

### Check Integration Status

Use the VS Code task "Show Shell Integration Status" or run:

```bash
echo "TERM_PROGRAM: $TERM_PROGRAM"
echo "VSCODE_SHELL_INTEGRATION: $VSCODE_SHELL_INTEGRATION"
```

## VS Code Settings

The workspace is configured with optimal shell integration settings in `.vscode/settings.json`:

```json
{
  "terminal.integrated.shellIntegration.enabled": true,
  "terminal.integrated.shellIntegration.decorationsEnabled": "both",
  "terminal.integrated.shellIntegration.showCommandGuide": true,
  "terminal.integrated.stickyScroll.enabled": true,
  "terminal.integrated.suggest.enabled": true
}
```

## Learn More

- [VS Code Terminal Shell Integration Docs](https://code.visualstudio.com/docs/terminal/shell-integration)
- [Terminal Basics](https://code.visualstudio.com/docs/terminal/basics)
- [Terminal Profiles](https://code.visualstudio.com/docs/terminal/profiles)