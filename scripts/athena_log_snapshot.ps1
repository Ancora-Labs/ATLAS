param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [int]$TailLines = 40
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
'===CHECK ' + (Get-Date -Format o) + '===' | Out-File -FilePath $resolvedOutput -Encoding utf8
'---PROGRESS_LAST_40---' | Add-Content -Path $resolvedOutput
Get-Content 'state/progress.txt' -Tail $TailLines | Add-Content -Path $resolvedOutput
'---ATHENA_REVIEW_LAST_40---' | Add-Content -Path $resolvedOutput
if (Test-Path 'state/athena_plan_review.json') {
  Get-Content 'state/athena_plan_review.json' -Tail $TailLines | Add-Content -Path $resolvedOutput
} else {
  'state/athena_plan_review.json missing' | Add-Content -Path $resolvedOutput
}