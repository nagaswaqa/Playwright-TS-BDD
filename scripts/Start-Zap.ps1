<#
.SYNOPSIS
    Start an OWASP ZAP daemon (Docker) and wait until its API is reachable.

.DESCRIPTION
    Pulls and starts ghcr.io/zaproxy/zaproxy (the maintained successor to
    owasp/zap2docker-stable) in daemon mode, exposing the local API on
    127.0.0.1:<Port>. Tests run with ZAP_PROXY=1 will route all browser
    HTTP traffic through this daemon for passive scanning.

    See docs/AUTHORING/security-testing.md for the operator workflow.

.PARAMETER Port
    Local port to bind ZAP's daemon API to. Defaults to 8090.

.PARAMETER ApiKey
    API key ZAP requires for control-plane calls. Generated and persisted
    to .zap/api-key on first run; reused on subsequent runs so the
    Stop-Zap.ps1 orchestrator can authenticate.

.PARAMETER ContainerName
    Docker container name. Defaults to `playwright-bdd-zap`. Reused across
    runs so we can stop the previous daemon if it's still up.

.EXAMPLE
    npm run security:start
    npm run security:start -- -Port 9090
#>
[CmdletBinding()]
param(
    [int]$Port = 8090,
    [string]$ApiKey,
    [string]$ContainerName = 'playwright-bdd-zap'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# 1. Confirm Docker is available.
try {
    $null = docker version --format '{{.Server.Version}}'
} catch {
    Write-Error "[Start-Zap] Docker is required but not reachable. Install Docker Desktop, ensure it's running, then retry."
    exit 1
}

# 2. Resolve / persist the API key so Stop-Zap can read it back.
$zapDir = Join-Path $repoRoot '.zap'
if (-not (Test-Path $zapDir)) { New-Item -ItemType Directory -Path $zapDir | Out-Null }
$apiKeyFile = Join-Path $zapDir 'api-key'

if (-not $ApiKey) {
    if (Test-Path $apiKeyFile) {
        $ApiKey = (Get-Content $apiKeyFile -Raw).Trim()
    } else {
        $ApiKey = ([guid]::NewGuid().ToString('N'))
        $ApiKey | Set-Content -Path $apiKeyFile -Encoding ASCII -NoNewline
    }
}

# 3. Stop any leftover container from a previous run.
$existing = docker ps -aq --filter "name=^$ContainerName$"
if ($existing) {
    Write-Host "[Start-Zap] Removing previous '$ContainerName' container..." -ForegroundColor DarkGray
    docker rm -f $ContainerName | Out-Null
}

# 4. Make sure the report directory exists; ZAP writes the HTML+JSON there.
$reportDir = Join-Path $repoRoot 'reports/security'
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }

# 5. Start ZAP in daemon mode.
Write-Host "[Start-Zap] Starting ZAP daemon on 127.0.0.1:$Port (container: $ContainerName)..." -ForegroundColor Cyan
$image = 'ghcr.io/zaproxy/zaproxy:stable'
$cmd = @(
    'run',
    '-d',
    '--name', $ContainerName,
    '-p', "127.0.0.1:${Port}:${Port}",
    '-v', "${reportDir}:/zap/wrk:rw",
    $image,
    'zap.sh',
    '-daemon',
    '-host', '0.0.0.0',
    '-port', $Port,
    # The ZAP API and proxy share the same listener in modern ZAP. Binding
    # to 0.0.0.0 inside the container is required so the Docker port-forward
    # actually reaches the daemon — `127.0.0.1` (the default) is unreachable
    # from outside the container.
    '-config', 'network.localServers.mainProxy.address=0.0.0.0',
    '-config', "network.localServers.mainProxy.port=$Port",
    '-config', 'api.disablekey=false',
    '-config', "api.key=$ApiKey",
    '-config', 'api.addrs.addr.name=.*',
    '-config', 'api.addrs.addr.regex=true'
)

& docker @cmd | Out-Null

# 6. Poll the daemon until it's ready (≤ 240 s — ZAP's first cold start
#    inside Docker can take 90-180s as it copies its config tree to a fresh
#    home directory; subsequent starts complete in 10-30s.).
$deadline = (Get-Date).AddSeconds(240)
$ready = $false
do {
    Start-Sleep -Seconds 3
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/JSON/core/view/version/?apikey=$ApiKey" -TimeoutSec 5
        if ($resp.version) {
            $ready = $true
            Write-Host "[Start-Zap] ZAP $($resp.version) ready on port $Port." -ForegroundColor Green
            break
        }
    } catch { }
} until ((Get-Date) -gt $deadline)

if (-not $ready) {
    Write-Error "[Start-Zap] ZAP did not become ready within 240s. Check 'docker logs $ContainerName'."
    exit 1
}

# 7. Persist runtime state for the test runner + Stop-Zap.
@{
    port = $Port
    apiKey = $ApiKey
    containerName = $ContainerName
    startedAt = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path (Join-Path $zapDir 'session.json') -Encoding UTF8

Write-Host ''
Write-Host "[Start-Zap] Run tests now with ZAP_PROXY=1 (e.g. 'npm run test:security')." -ForegroundColor Yellow
Write-Host "[Start-Zap] Stop the daemon and emit the report with 'npm run security:stop'." -ForegroundColor Yellow
