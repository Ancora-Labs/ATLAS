# BOX Onboarding Terminal
# Opens as a new visible console window. Reads a manifest JSON, runs copilot CLI
# interactively so the user can chat with the onboarding agent, then writes a done
# flag and transcript when the session ends. The BOX daemon polls for the done flag.
#
# Usage (invoked automatically by onboarding_runner.ts):
#   pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/onboarding-terminal.ps1 -ManifestPath <path>

param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [Parameter(Mandatory = $false)]
  [int]$HoldSeconds = 10
)

$ErrorActionPreference = "Continue"
$ProgressPreference    = "SilentlyContinue"

# ── Read manifest ────────────────────────────────────────────────────────────
if (-not (Test-Path $ManifestPath)) {
  Write-Host "[ATLAS] ERROR: manifest not found at $ManifestPath" -ForegroundColor Red
  exit 1
}

$manifest    = Get-Content -Path $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$command     = [string]$manifest.command
$cliArgs     = @($manifest.args | ForEach-Object { [string]$_ })
$transcript  = [string]$manifest.transcriptPath
$consoleOut  = [string]$manifest.consoleOutputPath
$doneFlag    = [string]$manifest.doneFlagPath
$rootDir     = [string]$manifest.rootDir
$agentSlug   = [string]$manifest.agentSlug

# ── Working directory ────────────────────────────────────────────────────────
if ($rootDir -and (Test-Path $rootDir)) {
  Set-Location $rootDir
}

# ── Clear output file so any previous partial run doesn't bleed through ──────
'' | Set-Content -Path $transcript -Encoding UTF8 -Force
if ($consoleOut) {
  '' | Set-Content -Path $consoleOut -Encoding UTF8 -Force
}

try {
  $buffer = $Host.UI.RawUI.BufferSize
  if ($buffer.Height -lt 5000) {
    $Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size($buffer.Width, 5000)
  }
} catch {
  # Non-interactive hosts may reject buffer changes; continue best-effort.
}

# ── Start capturing ──────────────────────────────────────────────────────────
Start-Transcript -Path $transcript -Force -Append | Out-Null

# ── Banner ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║          ATLAS  —  BOX Onboarding        ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Agent  : $agentSlug" -ForegroundColor DarkCyan
Write-Host "  Status : Session open — waiting for your input" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Type your answers and press Enter after each one." -ForegroundColor DarkGray
Write-Host "  The session ends when you confirm the final plan." -ForegroundColor DarkGray
Write-Host ""

# ── Run copilot CLI interactively ────────────────────────────────────────────
$exitCode = 0
try {
  & $command @cliArgs
  $exitCode = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }
} catch {
  Write-Host ""
  Write-Host "  [ATLAS] ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $exitCode = 1
} finally {
  if ($consoleOut) {
    try {
      $rawUi = $Host.UI.RawUI
      $bufferSize = $rawUi.BufferSize
      $rectangle = New-Object System.Management.Automation.Host.Rectangle(0, 0, [Math]::Max(0, $bufferSize.Width - 1), [Math]::Max(0, $bufferSize.Height - 1))
      $cells = $rawUi.GetBufferContents($rectangle)
      $lines = for ($row = 0; $row -lt $cells.GetLength(0); $row++) {
        $chars = for ($col = 0; $col -lt $cells.GetLength(1); $col++) {
          $cells[$row, $col].Character
        }
        (-join $chars).TrimEnd()
      }
      ($lines -join [Environment]::NewLine).Trim() | Set-Content -Path $consoleOut -Encoding UTF8 -Force
    } catch {
      Get-Content -Path $transcript -Raw -Encoding UTF8 -ErrorAction SilentlyContinue | Set-Content -Path $consoleOut -Encoding UTF8 -Force
    }
  }
  Stop-Transcript | Out-Null
}

# ── Extract premium usage from transcript (if present) ─────────────────────
$premiumUsed = $null
try {
  if (Test-Path $transcript) {
    $rawTranscript = Get-Content -Path $transcript -Raw -Encoding UTF8
    $matches = [regex]::Matches($rawTranscript, 'Requests\s+(\d+)\s+Premium', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -gt 0) {
      $last = $matches[$matches.Count - 1]
      $premiumUsed = [int]$last.Groups[1].Value
    }
  }
} catch {
  $premiumUsed = $null
}

# ── Done ─────────────────────────────────────────────────────────────────────
"done:$exitCode" | Set-Content -Path $doneFlag -Encoding UTF8 -Force

Write-Host ""
Write-Host "  ══════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host "  Session complete. BOX is processing your input." -ForegroundColor Green
if ($premiumUsed -ne $null) {
  Write-Host "  Premium requests used: $premiumUsed / 1" -ForegroundColor Yellow
} else {
  Write-Host "  Premium requests used: unknown / 1" -ForegroundColor Yellow
}
Write-Host "  This window will close in $HoldSeconds seconds." -ForegroundColor DarkGray
Write-Host "  ══════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host ""

if ($HoldSeconds -gt 0) {
  Start-Sleep -Seconds $HoldSeconds
}
