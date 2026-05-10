param(
    [string]$Alias = 'cco',
    [string]$MarketplaceName = 'codex-claude-orchestrator-marketplace',
    [switch]$KeepMarketplace,
    [string]$CodexCommand = 'codex'
)

$ErrorActionPreference = 'Stop'
$codex = (Get-Command $CodexCommand -ErrorAction Stop).Source

try {
    & $codex 'mcp' 'remove' $Alias
} catch {
    Write-Host "MCP server '$Alias' was not installed."
}

if (-not $KeepMarketplace) {
    try {
        & $codex 'plugin' 'marketplace' 'remove' $MarketplaceName
    } catch {
        Write-Host "Marketplace '$MarketplaceName' was not installed."
    }
}
