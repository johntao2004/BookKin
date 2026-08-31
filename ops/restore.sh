#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/backup-directory" >&2
  exit 2
fi

SOURCE=$1
test -f "$SOURCE/database.dump"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$SOURCE" && sha256sum --check SHA256SUMS)
else
  (cd "$SOURCE" && shasum -a 256 --check SHA256SUMS)
fi

docker compose stop app worker
docker compose exec -T postgres dropdb --if-exists --username "${POSTGRES_USER:-bookkin}" "${POSTGRES_DB:-bookkin}"
docker compose exec -T postgres createdb --username "${POSTGRES_USER:-bookkin}" "${POSTGRES_DB:-bookkin}"
docker compose exec -T postgres pg_restore --username "${POSTGRES_USER:-bookkin}" --dbname "${POSTGRES_DB:-bookkin}" --clean --if-exists < "$SOURCE/database.dump"

LIBRARY_ROOTS=${BOOKKIN_LIBRARY_BACKUP_ROOTS:-${BOOKKIN_LIBRARY_MAIN:-./.local/library}}
ROOT_INDEX=0
OLD_IFS=$IFS
IFS=:
for LIBRARY_ROOT in $LIBRARY_ROOTS; do
  ARCHIVE="$SOURCE/recoverable-root-$ROOT_INDEX.tar.gz"
  if [ -f "$ARCHIVE" ]; then
    test -d "$LIBRARY_ROOT"
    tar -C "$LIBRARY_ROOT" -xzf "$ARCHIVE"
  fi
  ROOT_INDEX=$((ROOT_INDEX + 1))
done
IFS=$OLD_IFS

docker compose start app worker
echo "Restore completed from $SOURCE"
