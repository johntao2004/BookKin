#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIRECTORY="$(cd "$SCRIPT_DIRECTORY/.." && pwd)"
LIBRARY_ROOT="${BOOKKIN_DEMO_LIBRARY_ROOT:-$PROJECT_DIRECTORY/.local/library}"
DATABASE_HOST="${BOOKKIN_DATABASE_HOST:-127.0.0.1}"
DATABASE_PORT="${BOOKKIN_DATABASE_PORT:-5432}"
DATABASE_NAME="${BOOKKIN_DATABASE_NAME:-bookkin}"
DATABASE_USER="${BOOKKIN_DATABASE_USER:-bookkin}"
export PGPASSWORD="${BOOKKIN_DATABASE_PASSWORD:-bookkin-local-dev}"

PSQL=(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1)

TRASH_RELATIVE_PATH=".bookkin-trash/4fa12d/声之来信.epub"
TRASH_ABSOLUTE_PATH="$LIBRARY_ROOT/$TRASH_RELATIVE_PATH"
TRASH_SOURCE_PATH="$LIBRARY_ROOT/顾安安/声之来信.epub"
mkdir -p "$(dirname "$TRASH_ABSOLUTE_PATH")"
if [[ -f "$TRASH_SOURCE_PATH" && ! -f "$TRASH_ABSOLUTE_PATH" ]]; then
  mv "$TRASH_SOURCE_PATH" "$TRASH_ABSOLUTE_PATH"
elif [[ ! -f "$TRASH_SOURCE_PATH" && ! -f "$TRASH_ABSOLUTE_PATH" ]]; then
  echo "《声之来信》的原文件和回收文件均不存在，拒绝创建空壳回收记录。" >&2
  exit 1
fi

"${PSQL[@]}" \
  -v trash_path="$TRASH_RELATIVE_PATH" \
  -f "$SCRIPT_DIRECTORY/seed-demo-data.sql"

echo "真实演示数据已写入 PostgreSQL，回收站记录有对应文件。"
