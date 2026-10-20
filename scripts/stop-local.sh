#!/usr/bin/env bash
# 根据 PID 与命令行身份停止本仓库快照启动的 API/Worker，避免终止被复用 PID 指向的其他进程。
# Stops API/Worker processes owned by this repository's runtime snapshots, checking command identity to avoid terminating reused PIDs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$REPO_ROOT/.local/run"

stop_profile() {
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
    if [[ "$command" != *"$RUN_DIR/bookkin-"*".jar"*"--spring.profiles.active=$profile"* ]]; then
      echo "Refusing to stop PID $pid because it is not a managed $profile process." >&2
      exit 1
    fi
    kill "$pid"
  fi
  rm -f "$pid_file"
}

stop_profile api
stop_profile worker
echo "Local API and Worker stopped."
