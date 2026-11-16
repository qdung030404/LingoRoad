#!/usr/bin/env bash
# ==============================================================================
# LingoRoad AI/ML Microservice Launcher Script (Python FastAPI) - Linux
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$SCRIPT_DIR/apps/ml"
VENV_PYTHON="$ML_DIR/.venv/bin/python"
VENV_UVICORN="$ML_DIR/.venv/bin/uvicorn"

if [[ ! -f "$VENV_PYTHON" ]] || [[ ! -f "$VENV_UVICORN" ]]; then
    echo -e "\033[31m[!] Khong tim thay virtualenv tai: $ML_DIR/.venv\033[0m"
    echo -e "\033[33m[*] Vui long khoi tao virtualenv truoc khi chay:\033[0m"
    echo "    cd apps/ml"
    echo "    python3 -m venv .venv"
    echo "    source .venv/bin/activate"
    echo "    pip install -r requirements.txt"
    exit 1
fi

echo -e "\033[36m>>> Khoi chay LingoRoad AI/ML Service tai: http://localhost:8001\033[0m"
cd "$ML_DIR"
exec "$VENV_UVICORN" lingoroad_ml.serving.app:app --host 0.0.0.0 --port 8001 --reload "$@"
