<#
.SYNOPSIS
    Operator entry point for stage 1 of the recording pipeline (recorder-agent).

.DESCRIPTION
    Resolves the target URL (parameter -> BASE_URL in config/.env.UB.<env>),
    then launches scripts/recorder-server.js. The recorder server captures
    user interactions in a Chromium window and, when the operator types
    "export", normalizes the payload IN-PROCESS and writes only
    recordings/normalized-<ts>.json. No raw JSON is persisted.

.PARAMETER Url
    Application URL to record against. If omitted, BASE_URL from
    config/.env.UB.<Environment> is used.

.PARAMETER Environment
    Environment key (matches config/.env.UB.<env>). Defaults to "dev".

.EXAMPLE
    npm run recorder:start

.EXAMPLE
    npm run recorder:start -- -Url https://app.example.com

.EXAMPLE
    npm run recorder:start -- -Environment qa
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Url,

    [string]$Environment = 'dev',

    [int]$RecorderPort = 47835
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Read-BaseUrlFromEnv {
    param([string]$EnvKey)
    $envFile = Join-Path $repoRoot "config/.env.UB.$EnvKey"
    if (-not (Test-Path $envFile)) { return $null }
    $line = Select-String -Path $envFile -Pattern '^\s*BASE_URL\s*=' | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line.Line -split '=', 2)[1]
    return $value.Trim().Trim('"').Trim("'")
}

if (-not $Url) {
    $Url = Read-BaseUrlFromEnv -EnvKey $Environment
}

if (-not $Url) {
    Write-Error "No URL provided. Pass -Url <url> or set BASE_URL in config/.env.UB.$Environment."
    exit 1
}

# Pin the recorder server output to a fresh recordings/normalized-<ts>.json so
# the operator gets a predictable artefact regardless of who started the run.
$stamp     = Get-Date -Format 'yyyyMMddHHmmss'
$normalDir = Join-Path $repoRoot 'recordings'
if (-not (Test-Path $normalDir)) { New-Item -ItemType Directory -Path $normalDir | Out-Null }
$normalPath = Join-Path $normalDir "normalized-$stamp.json"

Write-Host "[Start-Recorder] Target URL  : $Url" -ForegroundColor Cyan
Write-Host "[Start-Recorder] Environment : $Environment" -ForegroundColor Cyan
Write-Host "[Start-Recorder] Output      : $normalPath" -ForegroundColor DarkGray
Write-Host "[Start-Recorder] HTTP port   : $RecorderPort" -ForegroundColor DarkGray
Write-Host "[Start-Recorder] When finished, type 'export' + ENTER (or POST /export) to save the recording." -ForegroundColor Yellow

$env:RECORDER_OUT = $normalPath
$env:RECORDER_HTTP_PORT = $RecorderPort
try {
    & node (Join-Path $repoRoot 'scripts/recorder-server.js') $Url
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:\RECORDER_OUT -ErrorAction SilentlyContinue
    Remove-Item Env:\RECORDER_HTTP_PORT -ErrorAction SilentlyContinue
}

if ($exitCode -ne 0) {
    Write-Error "[Start-Recorder] Recorder server exited with code $exitCode."
    exit $exitCode
}

if (Test-Path $normalPath) {
    Write-Host ''
    Write-Host "[Start-Recorder] Done. Normalized output: $normalPath" -ForegroundColor Green
    Write-Host '[Start-Recorder] Next step (after operator review of the recording):'
    Write-Host "  npm run recorder:to-feature -- $normalPath <FeatureFileName>"
}
else {
    Write-Warning "[Start-Recorder] No recording was written. Did you type 'export'?"
    exit 1
}
