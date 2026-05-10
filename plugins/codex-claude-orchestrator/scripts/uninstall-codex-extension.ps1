param(
    [string]$Alias = 'codex-claude-orchestrator',
    [string[]]$AdditionalAliases = @('cco'),
    [string]$MarketplaceName = 'codex-claude-orchestrator-marketplace',
    [switch]$KeepMarketplace,
    [string]$CodexCommand = 'codex'
)

$ErrorActionPreference = 'Stop'
$codex = (Get-Command $CodexCommand -ErrorAction Stop).Source

foreach ($name in (@($Alias) + $AdditionalAliases | Select-Object -Unique)) {
    try {
        & $codex 'mcp' 'remove' $name
    } catch {
        Write-Host "MCP server '$name' was not installed."
    }
}

if (-not $KeepMarketplace) {
    try {
        & $codex 'plugin' 'marketplace' 'remove' $MarketplaceName
    } catch {
        Write-Host "Marketplace '$MarketplaceName' was not installed."
    }
}
