# BOX DOWN — gracefully stops daemon
# Usage: pwsh -NoProfile -File scripts/box-down.ps1

$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root

# --- 1. Graceful daemon stop via CLI ---
Write-Host "[box-down] sending stop request to daemon..."
$stopResult = & node --import tsx src/cli.ts stop 2>&1
Write-Host "[box-down] $stopResult"

# Wait up to 6 seconds for daemon to exit cleanly
$daemonPidFile = "state/daemon.pid"
if (Test-Path $daemonPidFile) {
    $daemonPid = [int](Get-Content $daemonPidFile -Raw).Trim()
    $waited = 0
    while ($waited -lt 6000) {
        if (-not (Get-Process -Id $daemonPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 500
        $waited += 500
    }
    # Force kill if still alive
    if (Get-Process -Id $daemonPid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $daemonPid -Force -ErrorAction SilentlyContinue
        Write-Host "[box-down] daemon force-killed (pid=$daemonPid)"
    } else {
        Write-Host "[box-down] daemon stopped cleanly"
    }
    Remove-Item $daemonPidFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "BOX is down."
