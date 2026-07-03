# PowerShell mirror of the Makefile (this machine has no GNU make).
# Usage: .\tasks.ps1 <api|web|dev|seed|test|reset-memory|smoke|lint>

param([Parameter(Mandatory = $true)][string]$Target)

$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

switch ($Target) {
    "api"          { & $py -m uvicorn praxis.main:app --app-dir backend --reload --port 8000 }
    "web"          { Set-Location (Join-Path $PSScriptRoot "frontend"); npm run dev }
    "dev"          {
        Start-Process pwsh -ArgumentList "-NoExit", "-File", "$PSScriptRoot\tasks.ps1", "api"
        & "$PSScriptRoot\tasks.ps1" web
    }
    "seed"         { & $py scripts/seed.py }
    "test"         { & $py -m pytest -v }
    "reset-memory" { & $py scripts/reset_memory.py }
    "smoke"        { & $py scripts/cognee_smoke.py }
    "lint"         { & $py -m ruff check backend scripts; & $py -m black --check backend scripts }
    default        { Write-Error "Unknown target: $Target" }
}
