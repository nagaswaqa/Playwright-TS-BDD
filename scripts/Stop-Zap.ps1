<#
.SYNOPSIS
    Stop the ZAP daemon, write reports/security/zap-report.{html,json},
    and (optionally) fail the run on High-severity findings.

.DESCRIPTION
    Reads .zap/session.json (written by Start-Zap.ps1) for the running
    container's port + API key, asks ZAP to render its built-in
    "traditional-html" and "traditional-json" reports, copies them out of
    the container, then stops it.

    See docs/AUTHORING/security-testing.md for the full workflow and how
    suppressions in resources/zap-baseline.conf are applied.

.PARAMETER FailOn
    Severity threshold that causes a non-zero exit. Defaults to "High".
    Valid values: "High" | "Medium" | "Low" | "Off".

.EXAMPLE
    npm run security:stop
    npm run security:stop -- -FailOn Medium
#>
[CmdletBinding()]
param(
    [ValidateSet('High','Medium','Low','Off')]
    [string]$FailOn = 'High'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$sessionFile = Join-Path $repoRoot '.zap/session.json'
if (-not (Test-Path $sessionFile)) {
    Write-Warning "[Stop-Zap] No .zap/session.json found. Was the daemon started? Nothing to do."
    exit 0
}
$session = Get-Content $sessionFile -Raw | ConvertFrom-Json
$port = $session.port
$apiKey = $session.apiKey
$container = $session.containerName

$reportDir = Join-Path $repoRoot 'reports/security'
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }

function Invoke-Zap {
    param([string]$Endpoint)
    $url = "http://127.0.0.1:$port/$Endpoint"
    if ($url -notmatch 'apikey=') {
        $sep = if ($url -match '\?') { '&' } else { '?' }
        $url = "${url}${sep}apikey=${apiKey}"
    }
    Invoke-RestMethod -Uri $url -TimeoutSec 60
}

# 1. Apply baseline suppressions if a config file exists.
$baseline = Join-Path $repoRoot 'resources/zap-baseline.conf'
if (Test-Path $baseline) {
    Write-Host "[Stop-Zap] Applying baseline suppressions from resources/zap-baseline.conf..." -ForegroundColor DarkGray
    Get-Content $baseline | Where-Object {
        $_ -and $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$'
    } | ForEach-Object {
        $parts = $_ -split '\t+', 2
        if ($parts.Count -lt 1) { return }
        $alertId = $parts[0].Trim()
        try {
            Invoke-Zap "JSON/pscan/action/setEnabled/?ids=$alertId&enabled=false" | Out-Null
        } catch {
            Write-Warning "[Stop-Zap] Could not suppress alert id '$alertId': $($_.Exception.Message)"
        }
    }
}

# 2. Generate reports inside the container, then copy them out.
$reportName = "zap-report-$((Get-Date).ToString('yyyyMMddHHmmss'))"
Write-Host "[Stop-Zap] Generating reports..." -ForegroundColor Cyan
try {
    Invoke-Zap "JSON/reports/action/generate/?title=Playwright-BDD%20ZAP%20Scan&template=traditional-html&reportFileName=$reportName.html&reportDir=/zap/wrk" | Out-Null
    Invoke-Zap "JSON/reports/action/generate/?title=Playwright-BDD%20ZAP%20Scan&template=traditional-json&reportFileName=$reportName.json&reportDir=/zap/wrk" | Out-Null
} catch {
    Write-Warning "[Stop-Zap] Report generation failed: $($_.Exception.Message)"
}

# 3. Read the JSON report so we can apply the FailOn gate before stopping the container.
$jsonPath = Join-Path $reportDir "$reportName.json"
$exitCode = 0
if (Test-Path $jsonPath) {
    $raw = Get-Content $jsonPath -Raw
    try {
        $report = $raw | ConvertFrom-Json
    } catch {
        $report = $null
        Write-Warning "[Stop-Zap] Could not parse $jsonPath."
    }
    if ($report) {
        $alerts = @()
        foreach ($site in @($report.site)) {
            if ($site.alerts) { $alerts += $site.alerts }
        }
        $highCount   = (@($alerts | Where-Object { $_.riskcode -eq '3' })).Count
        $mediumCount = (@($alerts | Where-Object { $_.riskcode -eq '2' })).Count
        $lowCount    = (@($alerts | Where-Object { $_.riskcode -eq '1' })).Count
        $infoCount   = (@($alerts | Where-Object { $_.riskcode -eq '0' })).Count

        Write-Host ''
        Write-Host "[Stop-Zap] Findings: High=$highCount  Medium=$mediumCount  Low=$lowCount  Informational=$infoCount" -ForegroundColor Yellow
        Write-Host "[Stop-Zap] Reports : $jsonPath" -ForegroundColor Yellow
        Write-Host "[Stop-Zap] Reports : $($jsonPath -replace '\.json$', '.html')" -ForegroundColor Yellow

        switch ($FailOn) {
            'High'   { if ($highCount -gt 0) { $exitCode = 1 } }
            'Medium' { if ($highCount -gt 0 -or $mediumCount -gt 0) { $exitCode = 1 } }
            'Low'    { if ($highCount -gt 0 -or $mediumCount -gt 0 -or $lowCount -gt 0) { $exitCode = 1 } }
            'Off'    { $exitCode = 0 }
        }
    }
} else {
    Write-Warning "[Stop-Zap] Report file not found at $jsonPath."
}

# 4. Stop and remove the container.
Write-Host "[Stop-Zap] Stopping ZAP container '$container'..." -ForegroundColor DarkGray
try {
    docker rm -f $container | Out-Null
} catch {
    Write-Warning "[Stop-Zap] Failed to remove container: $($_.Exception.Message)"
}

# 5. Clear session state.
Remove-Item $sessionFile -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
    Write-Error "[Stop-Zap] Failing because new findings met the '$FailOn' threshold. See $jsonPath."
}
exit $exitCode
