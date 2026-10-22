#!/usr/bin/env bash
# 向环境变量指定的本地 PostgreSQL 执行演示数据 SQL，并在 SQL 错误时停止。
# Runs demo-data SQL against the PostgreSQL target configured by environment variables and stops on SQL errors.
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATABASE_HOST="${BOOKKIN_DATABASE_HOST:-127.0.0.1}"
DATABASE_PORT="${BOOKKIN_DATABASE_PORT:-5432}"
DATABASE_NAME="${BOOKKIN_DATABASE_NAME:?Set an isolated *_test or *_demo database explicitly}"
if [[ "${1:-}" != "--allow-test-data" || ! "$DATABASE_NAME" =~ _(test|demo)$ ]]; then
  echo "Test fixtures require --allow-test-data and an isolated *_test or *_demo database." >&2
  exit 1
fi
DATABASE_USER="${BOOKKIN_DATABASE_USER:-bookkin}"
export PGPASSWORD="${BOOKKIN_DATABASE_PASSWORD:-bookkin-local-dev}"

PSQL=(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$SCRIPT_DIRECTORY/fixtures/seed-demo-data.sql"

echo "真实演示数据已写入 PostgreSQL；默认阅读进度、阅读时长与批注保持为空。"
