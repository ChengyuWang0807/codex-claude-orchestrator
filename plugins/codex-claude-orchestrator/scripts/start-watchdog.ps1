param(
    [string]$Config = '.\examples\tasks\claude-doc-preview.json',
    [int]$IntervalMinutes = 120,
    [string]$Until = '',
    [switch]$Background
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Path $PSScriptRoot -Parent
$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$cliPath = Join-Path $projectRoot 'bin\cco.mjs'
$logDir = Join-Path $projectRoot 'dist\watchdog'
$stdoutLogPath = Join-Path $logDir 'watchdog.stdout.log'
$stderrLogPath = Join-Path $logDir 'watchdog.stderr.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$argumentList = @(
    $cliPath
    'watch'
    '--config'
    (Resolve-Path $Config).Path
    '--interval-minutes'
    [string]$IntervalMinutes
)

if (-not [string]::IsNullOrWhiteSpace($Until)) {
    $target = [datetimeoffset]::Parse($Until)
    $now = [datetimeoffset]::Now
    $minutesRemaining = [math]::Max(0, [int][math]::Floor(($target - $now).TotalMinutes))
    $maxRuns = [math]::Max(1, [int][math]::Ceiling($minutesRemaining / $IntervalMinutes))
    $argumentList += @('--max-runs', [string]$maxRuns)
}

if ($Background) {
    Start-Process -FilePath $nodeCommand -ArgumentList $argumentList -WindowStyle Hidden -RedirectStandardOutput $stdoutLogPath -RedirectStandardError $stderrLogPath | Out-Null
    Write-Host "Watchdog started in background. Stdout: $stdoutLogPath"
    Write-Host "Watchdog stderr log: $stderrLogPath"
    exit 0
}

& $nodeCommand @argumentList 2>&1 | Tee-Object -FilePath $stdoutLogPath
