#!/usr/bin/env bash
# 构建并复制只读 JAR 快照，配置本地存储及持久密钥，启动 API/Worker 并在退出时清理受管进程。
# Builds a read-only JAR snapshot, configures local storage and persistent keys, starts API/Worker and cleans up managed processes on exit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$REPO_ROOT/apps/server"
RUN_DIR="$REPO_ROOT/.local/run"
LOG_DIR="$REPO_ROOT/.local/logs"
SOURCE_JAR="$SERVER_DIR/target/silvae-0.1.0-SNAPSHOT.jar"
API_PORT="${SILVAE_API_PORT:-8080}"
API_HEALTH_URL="http://127.0.0.1:${API_PORT}/actuator/health"

if [[ ! "$API_PORT" =~ ^[0-9]+$ ]]; then
  echo "SILVAE_API_PORT must be a numeric TCP port." >&2
  exit 1
fi
export SILVAE_API_PORT="$API_PORT"

LOCAL_LIBRARY_ROOT="${SILVAE_LIBRARY_MAIN:-$REPO_ROOT/.local/library}"
if [[ "$LOCAL_LIBRARY_ROOT" != /* ]]; then
  LOCAL_LIBRARY_ROOT="$REPO_ROOT/${LOCAL_LIBRARY_ROOT#./}"
fi
export SILVAE_STORAGE_ROOTS_0_NAME="${SILVAE_STORAGE_ROOTS_0_NAME:-主书库}"
export SILVAE_STORAGE_ROOTS_0_PATH="${SILVAE_STORAGE_ROOTS_0_PATH:-$LOCAL_LIBRARY_ROOT}"
export SILVAE_FONT_STORAGE_PATH="${SILVAE_FONT_STORAGE_PATH:-$LOCAL_LIBRARY_ROOT/.silvae-assets/fonts}"
export SILVAE_CONTENT_STORAGE_PATH="${SILVAE_CONTENT_STORAGE_PATH:-$HOME/.silvae/content}"
# Preserve the existing content location on local upgrades. Articles and vault
# retain distinct subdirectories; explicit *_STORAGE_PATH overrides are supported.

# 在不将可复用密钥写入应用配置的前提下，使本地加密 AI 设置在重启后仍可使用。生产部署必须自行设置 SILVAE_AI_SETTINGS_ENCRYPTION_KEY。
# Keep local encrypted AI settings usable across restarts without shipping a
# reusable key in application configuration. Production deployments must set
# SILVAE_AI_SETTINGS_ENCRYPTION_KEY themselves.
LOCAL_AI_KEY_FILE="${SILVAE_LOCAL_AI_SETTINGS_KEY_FILE:-$REPO_ROOT/.local/ai-settings-encryption-key}"
if [[ -z "${SILVAE_AI_SETTINGS_ENCRYPTION_KEY:-}" ]]; then
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
  export SILVAE_AI_SETTINGS_ENCRYPTION_KEY="$(tr -d '\n' < "$LOCAL_AI_KEY_FILE")"
fi

# 身份验证器使用独立实例密钥；持久化于受 Git 忽略的本机配置，不进入数据库。
LOCAL_TWO_FACTOR_KEY_FILE="${SILVAE_LOCAL_TWO_FACTOR_KEY_FILE:-$REPO_ROOT/.local/two-factor-encryption-key}"
if [[ -z "${SILVAE_TWO_FACTOR_ENCRYPTION_KEY:-}" ]]; then
  umask 077
  if [[ ! -s "$LOCAL_TWO_FACTOR_KEY_FILE" ]]; then
    mkdir -p "$(dirname "$LOCAL_TWO_FACTOR_KEY_FILE")"
    openssl rand -hex 32 > "$LOCAL_TWO_FACTOR_KEY_FILE"
  fi
  export SILVAE_TWO_FACTOR_ENCRYPTION_KEY="$(tr -d '\n' < "$LOCAL_TWO_FACTOR_KEY_FILE")"
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"
mkdir -p "$LOCAL_LIBRARY_ROOT" "$SILVAE_FONT_STORAGE_PATH"

if [[ -z "${SILVAE_DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  LOCAL_DB_USER="${SILVAE_DATABASE_USER:-silvae}"
  LOCAL_DB_PASS="${SILVAE_DATABASE_PASSWORD:-silvae-local-dev}"
  if [[ ! "$LOCAL_DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ || ! "$LOCAL_DB_PASS" =~ ^[A-Za-z0-9._@%+=-]+$ ]]; then
    echo "SILVAE_DATABASE_USER/PASSWORD contain unsupported characters for automatic local database setup; set SILVAE_DATABASE_URL instead." >&2
    exit 1
  fi
  if ! PGPASSWORD="$LOCAL_DB_PASS" psql -h localhost -U "$LOCAL_DB_USER" -d silvae -c "SELECT 1" >/dev/null 2>&1; then
    psql -h localhost -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$LOCAL_DB_USER') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$LOCAL_DB_USER', '$LOCAL_DB_PASS');
  END IF;
END
\$\$;
SELECT format('CREATE DATABASE silvae OWNER %I', '$LOCAL_DB_USER')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'silvae')\\gexec
SQL
  fi
fi

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
    if [[ "$command" == *"$RUN_DIR/silvae-"*".jar"*"--spring.profiles.active=$profile"* ]]; then
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
RUNTIME_JAR="$RUN_DIR/silvae-$SNAPSHOT_ID.jar"
cp "$SOURCE_JAR" "$RUNTIME_JAR"
chmod 0444 "$RUNTIME_JAR"

stop_managed_process api
stop_managed_process worker

if python3 - "$API_PORT" <<'PY'
import socket
import sys

try:
    with socket.create_connection(("127.0.0.1", int(sys.argv[1])), timeout=0.5):
        sys.exit(0)
except OSError:
    sys.exit(1)
PY
then
  echo "Port $API_PORT is already in use; refusing to treat another service as the new API." >&2
  exit 1
fi

nohup java -jar "$RUNTIME_JAR" --spring.profiles.active=api > "$LOG_DIR/api.log" 2>&1 < /dev/null &
API_PID=$!
echo "$API_PID" > "$RUN_DIR/api.pid"

nohup java -jar "$RUNTIME_JAR" --spring.profiles.active=worker > "$LOG_DIR/worker.log" 2>&1 < /dev/null &
WORKER_PID=$!
echo "$WORKER_PID" > "$RUN_DIR/worker.pid"

API_READY=false
for _ in {1..240}; do
  if ! kill -0 "$API_PID" 2>/dev/null || ! kill -0 "$WORKER_PID" 2>/dev/null; then
    break
  fi
  if curl --silent --fail --max-time 1 "$API_HEALTH_URL" >/dev/null; then
    API_READY=true
    break
  fi
  sleep 0.5
done

if [[ "$API_READY" != true ]]; then
  kill "$API_PID" "$WORKER_PID" 2>/dev/null || true
  echo "Local backend failed to become healthy. See $LOG_DIR/api.log and $LOG_DIR/worker.log." >&2
  exit 1
fi

echo "$API_PORT" > "$REPO_ROOT/.local/api-port"
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
