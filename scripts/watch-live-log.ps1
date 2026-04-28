$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $repoRoot "state"
$activeSessionPath = Join-Path $stateDir "active_target_session.json"
$progressPath = Join-Path $stateDir "progress.txt"

function Read-NewTextChunk {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [long]$Offset
  )

  $fileStream = $null
  $streamReader = $null
  try {
    $fileStream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $null = $fileStream.Seek($Offset, [System.IO.SeekOrigin]::Begin)
    $streamReader = New-Object System.IO.StreamReader($fileStream)
    $text = $streamReader.ReadToEnd()
    return $text
  } finally {
    if ($streamReader -ne $null) {
      $streamReader.Dispose()
    }
    if ($fileStream -ne $null) {
      $fileStream.Dispose()
    }
  }
}

function Resolve-LiveLogPath {
  if (Test-Path $activeSessionPath) {
    try {
      $session = Get-Content -LiteralPath $activeSessionPath -Raw | ConvertFrom-Json
      $projectId = [string]$session.projectId
      $sessionId = [string]$session.sessionId
      if ($projectId -and $sessionId) {
        $sessionLogPath = Join-Path $stateDir (Join-Path (Join-Path "projects" $projectId) (Join-Path $sessionId "session_progress.log"))
        if (Test-Path $sessionLogPath) {
          return $sessionLogPath
        }
      }
    } catch {
      Write-Host "[watch-live-log] active session metadata unreadable, falling back to state/progress.txt"
    }
  }

  return $progressPath
}

$currentPath = $null
$currentOffset = 0L

while ($true) {
  $resolvedPath = Resolve-LiveLogPath

  if ($resolvedPath -ne $currentPath) {
    $currentPath = $resolvedPath
    $currentOffset = 0L

    if (-not (Test-Path $currentPath)) {
      Write-Host "[watch-live-log] waiting for log file $currentPath"
      Start-Sleep -Milliseconds 700
      continue
    }

    Write-Host "[watch-live-log] streaming $currentPath"
    Get-Content -LiteralPath $currentPath -Tail 60 | ForEach-Object { Write-Output $_ }

    try {
      $currentOffset = (Get-Item -LiteralPath $currentPath).Length
    } catch {
      $currentOffset = 0L
    }

    continue
  }

  if (-not $currentPath -or -not (Test-Path $currentPath)) {
    Start-Sleep -Milliseconds 700
    continue
  }

  try {
    $currentLength = (Get-Item -LiteralPath $currentPath).Length
    if ($currentLength -lt $currentOffset) {
      $currentOffset = 0L
    }

    if ($currentLength -gt $currentOffset) {
      $newText = Read-NewTextChunk -Path $currentPath -Offset $currentOffset
      $currentOffset = $currentLength

      if (-not [string]::IsNullOrEmpty($newText)) {
        $newText -split "`r?`n" | Where-Object { $_ -ne "" } | ForEach-Object { Write-Output $_ }
      }
    }
  } catch {
    Write-Host "[watch-live-log] read error for $currentPath : $($_.Exception.Message)"
  }

  Start-Sleep -Milliseconds 700
}