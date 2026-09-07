#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$REPO_ROOT/apps/server"
RUN_DIR="$REPO_ROOT/.local/run"
LOG_DIR="$REPO_ROOT/.local/logs"
SOURCE_JAR="$SERVER_DIR/target/bookkin-0.1.0-SNAPSHOT.jar"
API_PORT="${BOOKKIN_API_PORT:-8080}"
API_HEALTH_URL="http://127.0.0.1:${API_PORT}/actuator/health"

if [[ ! "$API_PORT" =~ ^[0-9]+$ ]]; then
  echo "BOOKKIN_API_PORT must be a numeric TCP port." >&2
  exit 1
fi

LOCAL_LIBRARY_ROOT="${BOOKKIN_LIBRARY_MAIN:-$REPO_ROOT/.local/library}"
if [[ "$LOCAL_LIBRARY_ROOT" != /* ]]; then
  LOCAL_LIBRARY_ROOT="$REPO_ROOT/${LOCAL_LIBRARY_ROOT#./}"
fi
export BOOKKIN_STORAGE_ROOTS_0_NAME="${BOOKKIN_STORAGE_ROOTS_0_NAME:-主书库}"
export BOOKKIN_STORAGE_ROOTS_0_PATH="${BOOKKIN_STORAGE_ROOTS_0_PATH:-$LOCAL_LIBRARY_ROOT}"
export BOOKKIN_FONT_STORAGE_PATH="${BOOKKIN_FONT_STORAGE_PATH:-$LOCAL_LIBRARY_ROOT/.bookkin-assets/fonts}"

# Keep local encrypted AI settings usable across restarts without shipping a
# reusable key in application configuration. Production deployments must set
# BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY themselves.
LOCAL_AI_KEY_FILE="${BOOKKIN_LOCAL_AI_SETTINGS_KEY_FILE:-$REPO_ROOT/.local/ai-settings-encryption-key}"
if [[ -z "${BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY:-}" ]]; then
  umask 077
  if [[ ! -s "$LOCAL_AI_KEY_FILE" ]]; then
    mkdir -p "$(dirname "$LOCAL_AI_KEY_FILE")"
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 32 > "$LOCAL_AI_KEY_FILE"
    else
      python3 - "$LOCAL_AI_KEY_FILE" <<'PY'
import secrets, sys
with open(sys.argv[1], "w", encoding="ascii") as key_file:
    key_file.write(secrets.token_hex(32))
PY
    fi
  fi
  export BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY="$(tr -d '\n' < "$LOCAL_AI_KEY_FILE")"
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"
mkdir -p "$LOCAL_LIBRARY_ROOT" "$BOOKKIN_FONT_STORAGE_PATH"

stop_managed_process() {
  local profile="$1"
  local pid_file="$RUN_DIR/$profile.pid"
  if [[ ! -f "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(tr -dc '0-9' < "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    local command
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command" == *"$RUN_DIR/bookkin-"*".jar"*"--spring.profiles.active=$profile"* ]]; then
      kill "$pid"
      for _ in {1..50}; do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.1
      done
    else
      echo "Refusing to stop PID $pid because it is not a managed $profile process." >&2
      exit 1
    fi
  fi
  rm -f "$pid_file"
}

"$SERVER_DIR/mvnw" -f "$SERVER_DIR/pom.xml" -DskipTests package

SNAPSHOT_ID="$(date +%Y%m%d-%H%M%S)-$$"
RUNTIME_JAR="$RUN_DIR/bookkin-$SNAPSHOT_ID.jar"
cp "$SOURCE_JAR" "$RUNTIME_JAR"
chmod 0444 "$RUNTIME_JAR"

stop_managed_process api
stop_managed_process worker

nohup java -jar "$RUNTIME_JAR" --spring.profiles.active=api > "$LOG_DIR/api.log" 2>&1 < /dev/null &
API_PID=$!
echo "$API_PID" > "$RUN_DIR/api.pid"

nohup java -jar "$RUNTIME_JAR" --spring.profiles.active=worker > "$LOG_DIR/worker.log" 2>&1 < /dev/null &
WORKER_PID=$!
echo "$WORKER_PID" > "$RUN_DIR/worker.pid"

API_READY=false
for _ in {1..60}; do
  if curl --silent --fail --max-time 1 "$API_HEALTH_URL" >/dev/null; then
    API_READY=true
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null || ! kill -0 "$WORKER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if [[ "$API_READY" != true ]]; then
  kill "$API_PID" "$WORKER_PID" 2>/dev/null || true
  echo "Local backend failed to become healthy. See $LOG_DIR/api.log and $LOG_DIR/worker.log." >&2
  exit 1
fi

echo "API ready at $API_HEALTH_URL (PID $API_PID); Worker ready (PID $WORKER_PID)."
echo "Immutable runtime snapshot: $RUNTIME_JAR"
echo "Keep this process running; press Ctrl+C to stop API and Worker."

cleanup() {
  trap - EXIT INT TERM
  stop_managed_process api
  stop_managed_process worker
}
trap cleanup EXIT INT TERM

wait "$API_PID" "$WORKER_PID"
