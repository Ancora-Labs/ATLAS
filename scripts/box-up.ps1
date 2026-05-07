# BOX UP — starts daemon in background (detached, survives terminal close)
# Usage: pwsh -NoProfile -File scripts/box-up.ps1

$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root

# Start daemon (detached, hidden window)
$daemon = Start-Process `
    -FilePath "node" `
    -ArgumentList "--import", "tsx", "src/cli.ts", "start" `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru
$daemon.Id | Out-File -FilePath "state/daemon.pid" -Force -Encoding ascii
Write-Host "[box-up] daemon started      pid=$($daemon.Id)"

Write-Host ""
Write-Host "BOX is running."
Write-Host "To stop:  pwsh -NoProfile -File scripts/box-down.ps1"
Write-Host "     or:  npm run box:down"
