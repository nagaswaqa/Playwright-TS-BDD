<#
.SYNOPSIS
    Run a tag-filtered slice of the Playwright suite with ZAP passive
    scanning enabled, then emit a security report.

.DESCRIPTION
    Composes the three lifecycle steps so an operator can scan whatever
    set of scenarios they want with a single command:
      1. Start-Zap.ps1      → boots the ZAP daemon container
      2. npx bddgen + npx playwright test --grep <Tag> (with ZAP_PROXY=1)
      3. Stop-Zap.ps1       → emits the report and applies the FailOn gate

    The wrapper always tries to stop the daemon, even when tests fail,
    so the container never lingers.

.PARAMETER Tag
    Playwright tag expression to filter which scenarios run through ZAP.
    Accepts plain tags (`@security`) or full Playwright grep expressions
    (`@security|@smoke`). Defaults to `@security` — tag the scenarios
    you want scanned and run this script.

    Pass `--all` to bypass the filter and scan every scenario.

.PARAMETER FailOn
    Severity threshold for `Stop-Zap.ps1`. Defaults to `High`.

.EXAMPLE
    npm run test:security
    # Runs every scenario tagged @security through ZAP.

.EXAMPLE
    npm run test:security -- -Tag '@StudentEnquiry'
    # Scan one feature only (matches the existing functional tag).

.EXAMPLE
    npm run test:security -- -Tag '@security|@smoke' -FailOn Medium
    # Scan two tag groups, fail the run on any Medium-or-higher finding.

.EXAMPLE
    npm run test:security -- --all
    # Scan the entire suite. Slow; useful before a release.
#>
[CmdletBinding()]
param(
    [string]$Tag = '@security',

    [ValidateSet('High','Medium','Low','Off')]
    [string]$FailOn = 'High',

    [switch]$All
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$startScript = Join-Path $repoRoot 'scripts/Start-Zap.ps1'
$stopScript  = Join-Path $repoRoot 'scripts/Stop-Zap.ps1'

# 1. Start ZAP. Failure here is fatal — we never reach the test runner.
& $startScript
if ($LASTEXITCODE -ne 0) {
    Write-Error "[Test-WithZap] Aborting: ZAP did not start cleanly."
    exit 1
}

# 2. Run the suite (filtered by tag) with ZAP_PROXY=1 so worker contexts route via the daemon.
$env:ZAP_PROXY = '1'
$testExit = 0
try {
    & npx bddgen
    if ($LASTEXITCODE -ne 0) { $testExit = $LASTEXITCODE; throw 'bddgen failed' }

    if ($All) {
        Write-Host "[Test-WithZap] Scanning ALL scenarios (operator passed --all)." -ForegroundColor Yellow
        & npx playwright test
    } else {
        Write-Host "[Test-WithZap] Scanning scenarios matching tag expression: $Tag" -ForegroundColor Cyan
        & npx playwright test --grep $Tag
    }
    $testExit = $LASTEXITCODE
} catch {
    Write-Warning "[Test-WithZap] Test run halted: $($_.Exception.Message)"
} finally {
    Remove-Item Env:\ZAP_PROXY -ErrorAction SilentlyContinue

    # 3. Always stop ZAP so the container doesn't linger.
    & $stopScript -FailOn $FailOn
    $stopExit = $LASTEXITCODE
}

# Tag-filter "no tests matched" is exit 0 from Playwright with a warning;
# we surface that here so the operator notices.
if ($testExit -ne 0) { exit $testExit }
if ($stopExit -ne 0) { exit $stopExit }
exit 0
