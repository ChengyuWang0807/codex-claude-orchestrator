param(
    [string]$Alias = 'codex-claude-orchestrator',
    [switch]$SkipMarketplace,
    [switch]$SkipMcp,
    [switch]$Force,
    [string]$CodexCommand = 'codex'
)

$ErrorActionPreference = 'Stop'

function Find-AncestorContaining {
    param(
        [string]$StartPath,
        [string]$RelativeNeedle
    )

    $current = Resolve-Path $StartPath
    while ($null -ne $current) {
        $candidate = Join-Path $current $RelativeNeedle
        if (Test-Path $candidate) {
            return $current
        }

        $parent = Split-Path -Path $current -Parent
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
            break
        }
        $current = $parent
    }

    return $null
}

$pluginRoot = (Resolve-Path (Split-Path -Path $PSScriptRoot -Parent)).Path
$releaseRoot = Find-AncestorContaining -StartPath $pluginRoot -RelativeNeedle '.agents\plugins\marketplace.json'
$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$codex = (Get-Command $CodexCommand -ErrorAction Stop).Source
$mcpServerPath = Join-Path $pluginRoot 'bin\cco-mcp-server.mjs'
$marketplacePath = if ($null -ne $releaseRoot) { Join-Path $releaseRoot '.agents\plugins\marketplace.json' } else { $null }
$legacyAlias = 'cco'

Write-Host "Plugin root: $pluginRoot"
if ($null -ne $releaseRoot) {
    Write-Host "Marketplace root: $releaseRoot"
}

if (-not $SkipMarketplace -and $null -ne $marketplacePath -and (Test-Path $marketplacePath)) {
    & $codex 'plugin' 'marketplace' 'add' $releaseRoot
}

if (-not $SkipMcp) {
    $hasExisting = $false
    try {
        & $codex 'mcp' 'get' $Alias '--json' 2>$null | Out-Null
        $hasExisting = $true
    } catch {
        $hasExisting = $false
    }

    $hasLegacy = $false
    if ($Alias -ne $legacyAlias) {
        try {
            & $codex 'mcp' 'get' $legacyAlias '--json' 2>$null | Out-Null
            $hasLegacy = $true
        } catch {
            $hasLegacy = $false
        }
    }

    if ($hasExisting -and -not $Force) {
        Write-Host "MCP server '$Alias' already exists. Re-run with -Force to replace it."
    } else {
        if ($hasExisting) {
            & $codex 'mcp' 'remove' $Alias
        }
        if ($hasLegacy) {
            if ($Force) {
                & $codex 'mcp' 'remove' $legacyAlias
                Write-Host "Removed legacy MCP server '$legacyAlias'."
            } else {
                Write-Host "Legacy MCP server '$legacyAlias' is still installed. Re-run with -Force to replace it with '$Alias'."
            }
        }
        & $codex 'mcp' 'add' $Alias '--' $nodeCommand $mcpServerPath
    }
}

Write-Host ''
Write-Host 'Validation commands:'
Write-Host "  node .\bin\cco.mjs doctor"
Write-Host "  codex mcp get $Alias --json"
Write-Host "  node .\scripts\test-mcp-server.mjs"
