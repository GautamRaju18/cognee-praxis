# Praxis — one-command startup.
#   .\start.ps1
# Clears stale graph-DB locks, starts Ollama (if needed) + API + web, and
# health-checks all three. Safe to re-run; it cleans up first.

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"

function Say($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }

Say "`n=== Praxis startup ===" "Cyan"

# 1. Clear stale cognee processes (orphaned ladybug DB-worker children hold the lock)
Say "Clearing stale processes..."
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
  Where-Object { $_.CommandLine -match 'multiprocess|uvicorn|praxis|cognee|ladybug' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2

# 2. Ollama (local LLM fallback for non-cached queries)
if (-not (Get-Process ollama)) {
  Say "Starting Ollama..."
  Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Say "Ollama already running." "DarkGray"
}

# 3. API
Say "Starting API (port 8000)..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root'; & '$py' -m uvicorn praxis.main:app --app-dir backend --port 8000"
) -WindowStyle Minimized

# 4. Web
Say "Starting web (port 5173)..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\frontend'; npm run dev"
) -WindowStyle Minimized

# 5. Health-check both
function Wait-Url($url, $name, $timeoutSec = 45) {
  for ($i = 0; $i -lt $timeoutSec; $i++) {
    try {
      $code = (Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing).StatusCode
      if ($code -eq 200) { Say "  $name ready ($url)" "Green"; return $true }
    } catch {}
    Start-Sleep -Seconds 1
  }
  Say "  $name did NOT come up at $url" "Red"; return $false
}

Say "`nWaiting for services..."
$apiOk = Wait-Url "http://127.0.0.1:8000/health" "API"
$webOk = Wait-Url "http://localhost:5173" "Web"

Write-Host ""
if ($apiOk -and $webOk) {
  Say "Praxis is up." "Green"
  Say "  →  http://localhost:5173" "Cyan"
} else {
  Say "One or more services failed to start — check the minimized windows." "Yellow"
}
