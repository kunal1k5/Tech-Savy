$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $repoRoot ".run-logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Get-ListeningProcessId {
  param([int]$Port)

  try {
    return (
      Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1 -ExpandProperty OwningProcess
    )
  } catch {
    return $null
  }
}

function Start-LoggedProcess {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [int]$Port,
    [string]$StdOutLog,
    [string]$StdErrLog
  )

  $existingPid = Get-ListeningProcessId -Port $Port
  if ($existingPid) {
    Write-Host "$Name is already listening on port $Port (PID $existingPid)."
    return
  }

  Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $StdOutLog `
    -RedirectStandardError $StdErrLog `
    -WindowStyle Hidden | Out-Null

  Start-Sleep -Seconds 3

  $listenerPid = Get-ListeningProcessId -Port $Port
  if ($listenerPid) {
    Write-Host "$Name started on port $Port (PID $listenerPid)."
    Write-Host "  Logs: $StdOutLog"
    Write-Host "        $StdErrLog"
    return
  }

  Write-Warning "$Name did not confirm port $Port yet. Check $StdOutLog and $StdErrLog."
}

$pythonExe = Join-Path $repoRoot ".venv\\Scripts\\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
  $pythonExe = "python"
}

Start-LoggedProcess `
  -Name "AI engine" `
  -FilePath $pythonExe `
  -ArgumentList @("-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001") `
  -WorkingDirectory (Join-Path $repoRoot "ai-engine") `
  -Port 5001 `
  -StdOutLog (Join-Path $logDir "ai-$timestamp.out.log") `
  -StdErrLog (Join-Path $logDir "ai-$timestamp.err.log")

Start-LoggedProcess `
  -Name "Backend" `
  -FilePath "npm.cmd" `
  -ArgumentList @("start") `
  -WorkingDirectory (Join-Path $repoRoot "backend") `
  -Port 5005 `
  -StdOutLog (Join-Path $logDir "backend-$timestamp.out.log") `
  -StdErrLog (Join-Path $logDir "backend-$timestamp.err.log")

Start-LoggedProcess `
  -Name "Frontend" `
  -FilePath "npm.cmd" `
  -ArgumentList @("start") `
  -WorkingDirectory (Join-Path $repoRoot "frontend") `
  -Port 3000 `
  -StdOutLog (Join-Path $logDir "frontend-$timestamp.out.log") `
  -StdErrLog (Join-Path $logDir "frontend-$timestamp.err.log")

Write-Host ""
Write-Host "GigShield AI should now be reachable at:"
Write-Host "  Frontend:  http://localhost:3000"
Write-Host "  Backend:   http://localhost:5005/api/health"
Write-Host "  AI engine: http://localhost:5001/health"
