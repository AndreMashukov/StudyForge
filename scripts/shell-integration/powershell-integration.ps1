# VS Code Shell Integration for PowerShell
# Add this line to your PowerShell profile:
# if ($env:TERM_PROGRAM -eq "vscode") { . "$PSScriptRoot/powershell-integration.ps1" }

# Check if running in VS Code terminal
if ($env:TERM_PROGRAM -ne "vscode") {
    return
}

# Enable VS Code shell integration if available
if (Get-Command code -ErrorAction SilentlyContinue) {
    # Use automatic integration if available
    if ($env:VSCODE_SHELL_INTEGRATION) {
        try {
            $integrationPath = code --locate-shell-integration-path pwsh
            if ($integrationPath -and (Test-Path $integrationPath)) {
                . $integrationPath
            }
        }
        catch {
            # Silently continue if integration fails
        }
    }
}
else {
    Write-Warning "'code' command not found. Please ensure VS Code is in your PATH."
}

# Set workspace root
$env:CODE_INSIGHTS_AI_ROOT = Resolve-Path (Join-Path $PSScriptRoot "../..")

# Custom prompt function to show current project context
function Prompt {
    $currentPath = Get-Location
    if ($currentPath.Path.StartsWith($env:CODE_INSIGHTS_AI_ROOT)) {
        $relativePath = $currentPath.Path.Substring($env:CODE_INSIGHTS_AI_ROOT.Length)
        if ([string]::IsNullOrEmpty($relativePath)) {
            $relativePath = "/"
        }
        Write-Host "[code-insights-ai:$relativePath] " -ForegroundColor Cyan -NoNewline
    }
    
    # Return the default prompt
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
}

# Nx shortcuts
function nx { npx nx @args }
function nxg { npx nx generate @args }
function nxr { npx nx run @args }
function nxb { npx nx build @args }
function nxt { npx nx test @args }
function nxl { npx nx lint @args }

# Quick navigation aliases
function cdweb { Set-Location (Join-Path $env:CODE_INSIGHTS_AI_ROOT "web") }
function cdfunctions { Set-Location (Join-Path $env:CODE_INSIGHTS_AI_ROOT "functions") }
function cdlibs { Set-Location (Join-Path $env:CODE_INSIGHTS_AI_ROOT "libs") }

# PowerShell-specific enhancements
# Enable command prediction (PowerShell 7.2+)
if ($PSVersionTable.PSVersion -ge [Version]"7.2.0") {
    Set-PSReadLineOption -PredictionSource History
}

# Enhanced tab completion
Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete

Write-Host "VS Code Shell Integration for code-insights-ai workspace loaded (PowerShell)." -ForegroundColor Green