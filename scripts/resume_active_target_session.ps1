param(
  [string]$SessionId = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$resumeArgs = @("--import", "tsx", "src/cli.ts", "resume")
if ($SessionId.Trim()) {
  $resumeArgs += @("--session", $SessionId.Trim())
}

Write-Host "[box] resuming active target session from dispatch checkpoint..."
& node @resumeArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  throw "Resume command failed with exit code $exitCode"
}

Write-Host "[box] resume command completed"