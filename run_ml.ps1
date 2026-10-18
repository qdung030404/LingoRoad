# ==============================================================================
# LingoRoad AI/ML Microservice Launcher Script (Python FastAPI)
# ==============================================================================

$ProjectRoot = $PSScriptRoot
$MlDir = "$ProjectRoot\apps\ml"
$VenvPython = "$MlDir\.venv\Scripts\python.exe"
$VenvUvicorn = "$MlDir\.venv\Scripts\uvicorn.exe"

if (-not (Test-Path $VenvUvicorn)) {
    Write-Host "[!] Khong tim thay virtualenv tai: $MlDir\.venv" -ForegroundColor Red
    Write-Host "[*] Vui long khoi tao virtualenv truoc khi chay:" -ForegroundColor Yellow
    Write-Host "    cd apps/ml"
    Write-Host "    python -m venv .venv"
    Write-Host "    .\.venv\Scripts\pip install -r requirements.txt"
    exit 1
}

Write-Host ">>> Khoi chay LingoRoad AI/ML Service tai: http://localhost:8001" -ForegroundColor Cyan
Set-Location $MlDir
& $VenvUvicorn lingoroad_ml.serving.app:app --host 0.0.0.0 --port 8001 --reload
