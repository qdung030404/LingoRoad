#!/usr/bin/env bash
# ==============================================================================
# LingoRoad Mobile Launcher Script (Flutter) - Linux
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$SCRIPT_DIR/apps/mobile"

if [[ ! -f "$MOBILE_DIR/pubspec.yaml" ]]; then
  echo "Khong tim thay apps/mobile/pubspec.yaml." >&2
  exit 1
fi

EMU=false
DEVICE=""
CLEAN=false
API_BASE_URL="http://10.0.2.2:3000"
FIREBASE_CONFIG=""
GOOGLE_SERVER_CLIENT_ID=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--emu)
      EMU=true
      shift
      ;;
    -d|--device)
      DEVICE="$2"
      shift 2
      ;;
    -c|--clean)
      CLEAN=true
      shift
      ;;
    --api-base-url)
      API_BASE_URL="$2"
      shift 2
      ;;
    --firebase-config)
      FIREBASE_CONFIG="$2"
      shift 2
      ;;
    --google-server-client-id)
      GOOGLE_SERVER_CLIENT_ID="$2"
      shift 2
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

SDK_CANDIDATES=(
  "${ANDROID_HOME:-}"
  "${ANDROID_SDK_ROOT:-}"
  "$HOME/Android/Sdk"
)

SDK_DIR=""
for candidate in "${SDK_CANDIDATES[@]}"; do
  if [[ -n "$candidate" && -d "$candidate" ]]; then
    SDK_DIR="$candidate"
    break
  fi
done

if command -v adb >/dev/null 2>&1; then
  ADB_TOOL="adb"
elif [[ -n "$SDK_DIR" && -x "$SDK_DIR/platform-tools/adb" ]]; then
  ADB_TOOL="$SDK_DIR/platform-tools/adb"
else
  echo "Khong tim thay adb. Vui long cai Android SDK hoac them vao PATH." >&2
  exit 1
fi

get_online_devices() {
  "$ADB_TOOL" devices 2>/dev/null | awk '$2 == "device" { print $1 }'
}

if [[ "$EMU" == true ]]; then
  ONLINE_EMU=$(get_online_devices | grep '^emulator-' | head -n 1 || true)
  if [[ -z "$ONLINE_EMU" ]]; then
    if command -v emulator >/dev/null 2>&1; then
      EMULATOR_TOOL="emulator"
    elif [[ -n "$SDK_DIR" && -x "$SDK_DIR/emulator/emulator" ]]; then
      EMULATOR_TOOL="$SDK_DIR/emulator/emulator"
    else
      echo "Chua cai Android Emulator. Xem docs/first-demo.md." >&2
      exit 1
    fi

    AVD_LIST=$("$EMULATOR_TOOL" -list-avds || true)
    if echo "$AVD_LIST" | grep -qx "LingoRoad_Demo_API35"; then
      AVD_NAME="LingoRoad_Demo_API35"
    else
      AVD_NAME=$(echo "$AVD_LIST" | head -n 1)
    fi

    if [[ -z "$AVD_NAME" ]]; then
      echo "Chua co AVD. Xem docs/first-demo.md." >&2
      exit 1
    fi

    echo ">>> Dang khoi dong Android Emulator: $AVD_NAME..."
    "$EMULATOR_TOOL" -avd "$AVD_NAME" -no-snapshot-load > /dev/null 2>&1 &

    BOOTED=false
    START_TIME=$(date +%s)
    while (( $(date +%s) - START_TIME < 180 )); do
      EMU_DEV=$(get_online_devices | grep '^emulator-' | head -n 1 || true)
      if [[ -n "$EMU_DEV" ]]; then
        BOOT_STATUS=$("$ADB_TOOL" -s "$EMU_DEV" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
        if [[ "$BOOT_STATUS" == "1" ]]; then
          BOOTED=true
          break
        fi
      fi
      sleep 2
    done

    if [[ "$BOOTED" != true ]]; then
      echo "May ao chua khoi dong xong trong 180 giay." >&2
      exit 1
    fi
  fi
fi

mapfile -t ONLINE_DEVICES < <(get_online_devices)
if [[ -z "$DEVICE" ]]; then
  if [[ "$EMU" == true ]]; then
    for dev in "${ONLINE_DEVICES[@]}"; do
      if [[ "$dev" =~ ^emulator- ]]; then
        DEVICE="$dev"
        break
      fi
    done
  elif [[ ${#ONLINE_DEVICES[@]} -eq 1 ]]; then
    DEVICE="${ONLINE_DEVICES[0]}"
  else
    echo "Chi dinh --device <adb-id> hoac --emu de chon thiet bi." >&2
    echo "Cac thiet bi dang ket noi: ${ONLINE_DEVICES[*]:-Khong co}" >&2
    exit 1
  fi
fi

if [[ -z "$DEVICE" ]]; then
  echo "Khong co thiet bi Android san sang." >&2
  exit 1
fi

FIREBASE_ARGS=()
if [[ -z "$FIREBASE_CONFIG" ]]; then
  LOCAL_CONFIG="$MOBILE_DIR/firebase-config.local.json"
  if [[ -f "$LOCAL_CONFIG" ]]; then
    FIREBASE_CONFIG="$LOCAL_CONFIG"
  fi
fi

if [[ -n "$FIREBASE_CONFIG" && -f "$FIREBASE_CONFIG" ]]; then
  FIREBASE_ARGS+=("--dart-define-from-file=$FIREBASE_CONFIG")
  EMU_HOST=$(grep -o '"FIREBASE_AUTH_EMULATOR_HOST"[^,]*' "$FIREBASE_CONFIG" | cut -d'"' -f4 || true)
  if [[ -n "$EMU_HOST" ]]; then
    EMU_PORT=$(echo "$EMU_HOST" | cut -d':' -f2 || true)
    if [[ -n "$EMU_PORT" ]]; then
      "$ADB_TOOL" -s "$DEVICE" reverse "tcp:$EMU_PORT" "tcp:$EMU_PORT" || true
    fi
  fi
fi

if [[ ! "$DEVICE" =~ ^emulator- ]] && [[ "$API_BASE_URL" == "http://10.0.2.2:3000" ]]; then
  "$ADB_TOOL" -s "$DEVICE" reverse tcp:3000 tcp:3000
  API_BASE_URL="http://127.0.0.1:3000"
fi

cd "$MOBILE_DIR"
if [[ "$CLEAN" == true ]]; then
  flutter clean
fi

flutter pub get

RUN_ARGS=(
  run
  -d "$DEVICE"
  "${FIREBASE_ARGS[@]}"
  "--dart-define=APP_ENV=dev"
  "--dart-define=API_BASE_URL=$API_BASE_URL"
)

if [[ -n "$GOOGLE_SERVER_CLIENT_ID" ]]; then
  RUN_ARGS+=("--dart-define=GOOGLE_SERVER_CLIENT_ID=$GOOGLE_SERVER_CLIENT_ID")
fi

if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  RUN_ARGS+=("${EXTRA_ARGS[@]}")
fi

echo ">>> Khoi chay Flutter tren thiet bi: $DEVICE..."
exec flutter "${RUN_ARGS[@]}"
