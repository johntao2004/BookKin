#!/bin/sh
# Restore a complete BookKin recovery point. Run only against an isolated
# Compose project or after confirming the destructive database replacement.
set -eu

DRY_RUN=false
if [ "$#" -eq 2 ] && [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 [--dry-run] /path/to/backup-directory" >&2
  exit 2
fi

SOURCE=$1
test -d "$SOURCE"
test -f "$SOURCE/manifest.txt"
test -f "$SOURCE/database.dump"
test -f "$SOURCE/SHA256SUMS"

grep -qx 'format=bookkin-backup-v2' "$SOURCE/manifest.txt" || {
  echo "Unsupported or incomplete backup manifest" >&2
  exit 1
}
ROOT_COUNT=$(sed -n 's/^library-root-count=//p' "$SOURCE/manifest.txt")
case "$ROOT_COUNT" in
  ''|*[!0-9]*) echo "Invalid library-root-count in manifest" >&2; exit 1 ;;
esac
test "$ROOT_COUNT" -gt 0 || { echo "Backup contains no library roots" >&2; exit 1; }

FONT_ARCHIVE=$(sed -n 's/^font-archive=//p' "$SOURCE/manifest.txt")
case "$FONT_ARCHIVE" in
  fonts.tar.gz) test -f "$SOURCE/fonts.tar.gz" ;;
  embedded-in-library) ;;
  *) echo "Backup contains no recognized font archive" >&2; exit 1 ;;
esac

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$SOURCE" && sha256sum --check SHA256SUMS)
else
  (cd "$SOURCE" && shasum -a 256 --check SHA256SUMS)
fi

validate_archive() {
  archive=$1
  # Archives are generated from '.', nevertheless reject absolute paths and
  # parent-directory components before extracting a supplied recovery point.
  tar -tzf "$archive" | awk '
    {
      path = $0
      sub(/^\.\//, "", path)
      sub(/\/$/, "", path)
      if (path == "" || path == ".") next
      if (path ~ /^\// || path == ".." || path ~ /^\.\.\// || path ~ /\/\.\.\//) exit 1
    }
  '
}

ROOT_INDEX=0
while [ "$ROOT_INDEX" -lt "$ROOT_COUNT" ]; do
  ARCHIVE="$SOURCE/recoverable-root-$ROOT_INDEX.tar.gz"
  test -f "$ARCHIVE" || { echo "Missing $ARCHIVE" >&2; exit 1; }
  validate_archive "$ARCHIVE" || { echo "Unsafe archive: $ARCHIVE" >&2; exit 1; }
  ROOT_INDEX=$((ROOT_INDEX + 1))
done
if [ "$FONT_ARCHIVE" = fonts.tar.gz ]; then
  validate_archive "$SOURCE/fonts.tar.gz" || { echo "Unsafe font archive" >&2; exit 1; }
fi

LIBRARY_ROOTS=${BOOKKIN_LIBRARY_BACKUP_ROOTS:-${BOOKKIN_LIBRARY_MAIN:-./.local/library}}
ROOTS_FILE=$(mktemp "${TMPDIR:-/tmp}/bookkin-restore-roots.XXXXXX")
cleanup() { rm -f "$ROOTS_FILE"; }
trap cleanup EXIT INT TERM
OLD_IFS=$IFS
IFS=:
for configured_root in $LIBRARY_ROOTS; do
  test -n "$configured_root" || { echo "Empty library root path" >&2; exit 1; }
  printf '%s\n' "$configured_root" >> "$ROOTS_FILE"
done
IFS=$OLD_IFS
CONFIGURED_COUNT=$(wc -l < "$ROOTS_FILE" | tr -d ' ')
test "$CONFIGURED_COUNT" -eq "$ROOT_COUNT" || {
  echo "Configured library root count ($CONFIGURED_COUNT) differs from backup ($ROOT_COUNT)" >&2
  exit 1
}

FONT_ROOT=${BOOKKIN_FONT_BACKUP_ROOT:-${BOOKKIN_FONT_STORAGE:-./.local/fonts}}
if [ "$DRY_RUN" = true ]; then
  if [ "$FONT_ARCHIVE" = fonts.tar.gz ]; then
    printf 'DRY RUN: would restore fonts to %s\n' "$FONT_ROOT"
  else
    echo 'DRY RUN: fonts are embedded in a library archive'
  fi
  echo "DRY RUN PASS: $ROOT_COUNT library roots, database, and manifest verified"
  exit 0
fi

ROOT_INDEX=0
while IFS= read -r LIBRARY_ROOT; do
  test -d "$LIBRARY_ROOT" || {
    echo "Library root is not mounted: $LIBRARY_ROOT" >&2
    exit 1
  }
  ROOT_INDEX=$((ROOT_INDEX + 1))
done < "$ROOTS_FILE"

SERVICES_STOPPED=false
restart_services() {
  if [ "$SERVICES_STOPPED" = true ]; then
    docker compose start app worker >/dev/null 2>&1 || true
  fi
}
trap 'restart_services; cleanup' EXIT INT TERM

docker compose stop app worker
SERVICES_STOPPED=true
docker compose exec -T postgres dropdb --if-exists --username "${POSTGRES_USER:-bookkin}" "${POSTGRES_DB:-bookkin}"
docker compose exec -T postgres createdb --username "${POSTGRES_USER:-bookkin}" "${POSTGRES_DB:-bookkin}"
docker compose exec -T postgres pg_restore --username "${POSTGRES_USER:-bookkin}" --dbname "${POSTGRES_DB:-bookkin}" --clean --if-exists < "$SOURCE/database.dump"

ROOT_INDEX=0
while IFS= read -r LIBRARY_ROOT; do
  tar -C "$LIBRARY_ROOT" -xzf "$SOURCE/recoverable-root-$ROOT_INDEX.tar.gz"
  ROOT_INDEX=$((ROOT_INDEX + 1))
done < "$ROOTS_FILE"

if [ "$FONT_ARCHIVE" = fonts.tar.gz ]; then
  mkdir -p "$FONT_ROOT"
  tar -C "$FONT_ROOT" -xzf "$SOURCE/fonts.tar.gz"
fi

docker compose start app worker
SERVICES_STOPPED=false
trap - EXIT INT TERM
cleanup
echo "Restore completed from $SOURCE"
