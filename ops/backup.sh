#!/bin/sh
# Create a self-contained recovery point for the database and every persistent
# BookKin file root. The cache is derived data and is intentionally excluded.
set -eu

BACKUP_ROOT=${BOOKKIN_BACKUP_DIR:-./.local/backups}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DESTINATION="$BACKUP_ROOT/$STAMP"
ROOTS_FILE=$(mktemp "${TMPDIR:-/tmp}/bookkin-backup-roots.XXXXXX")

cleanup() {
  rm -f "$ROOTS_FILE"
}
trap cleanup EXIT INT TERM

mkdir -p "$DESTINATION"

canonical_directory() {
  test -d "$1" || {
    echo "Directory does not exist: $1" >&2
    exit 1
  }
  (cd "$1" && pwd -P)
}

LIBRARY_ROOTS=${BOOKKIN_LIBRARY_BACKUP_ROOTS:-${BOOKKIN_LIBRARY_MAIN:-./.local/library}}
OLD_IFS=$IFS
IFS=:
for configured_root in $LIBRARY_ROOTS; do
  test -n "$configured_root" || {
    echo "BOOKKIN_LIBRARY_BACKUP_ROOTS contains an empty path" >&2
    exit 1
  }
  canonical_directory "$configured_root" >> "$ROOTS_FILE"
done
IFS=$OLD_IFS

ROOT_COUNT=$(wc -l < "$ROOTS_FILE" | tr -d ' ')
test "$ROOT_COUNT" -gt 0 || {
  echo "At least one library root is required" >&2
  exit 1
}

# Validate the font mount before starting the database dump so a missing mount
# fails fast without producing a partial-looking recovery point.
FONT_ROOT=${BOOKKIN_FONT_BACKUP_ROOT:-${BOOKKIN_FONT_STORAGE:-./.local/fonts}}
FONT_REAL=$(canonical_directory "$FONT_ROOT")
FONT_EMBEDDED=false
while IFS= read -r LIBRARY_ROOT; do
  ROOT_REAL=$(canonical_directory "$LIBRARY_ROOT")
  case "$FONT_REAL/" in
    "$ROOT_REAL"|"$ROOT_REAL"/*) FONT_EMBEDDED=true ;;
  esac
done < "$ROOTS_FILE"

DESTINATION_REAL=$(canonical_directory "$DESTINATION")
CHECKSUM_FILES="manifest.txt database.dump"

cat > "$DESTINATION/manifest.txt" <<EOF
format=bookkin-backup-v2
created-at=$STAMP
library-root-count=$ROOT_COUNT
EOF

docker compose exec -T postgres pg_dump \
  --username "${POSTGRES_USER:-bookkin}" \
  --dbname "${POSTGRES_DB:-bookkin}" \
  --format custom > "$DESTINATION/database.dump"

ROOT_INDEX=0
while IFS= read -r LIBRARY_ROOT; do
  ROOT_REAL=$(canonical_directory "$LIBRARY_ROOT")
  case "$DESTINATION_REAL/" in
    "$ROOT_REAL"|"$ROOT_REAL"/*)
      echo "Backup destination must not be inside library root: $LIBRARY_ROOT" >&2
      exit 1
      ;;
  esac

  ARCHIVE="recoverable-root-$ROOT_INDEX.tar.gz"
  # Archive '.' so hidden directories and the root's regular book files are
  # included. Symlinks are archived as links; tar does not follow them.
  tar -C "$LIBRARY_ROOT" --exclude='./.bookkin-cache' -czf "$DESTINATION/$ARCHIVE" .
  printf 'library-root-%s=%s\n' "$ROOT_INDEX" "$LIBRARY_ROOT" >> "$DESTINATION/manifest.txt"
  CHECKSUM_FILES="$CHECKSUM_FILES $ARCHIVE"
  ROOT_INDEX=$((ROOT_INDEX + 1))
done < "$ROOTS_FILE"

if [ "$FONT_EMBEDDED" = true ]; then
  printf 'font-root=%s\nfont-archive=embedded-in-library\n' "$FONT_ROOT" >> "$DESTINATION/manifest.txt"
else
  tar -C "$FONT_ROOT" -czf "$DESTINATION/fonts.tar.gz" .
  printf 'font-root=%s\nfont-archive=fonts.tar.gz\n' "$FONT_ROOT" >> "$DESTINATION/manifest.txt"
  CHECKSUM_FILES="$CHECKSUM_FILES fonts.tar.gz"
fi

# The manifest itself is checked too, so a missing root or font archive cannot
# be mistaken for a complete backup.
# shellcheck disable=SC2086
set -- $CHECKSUM_FILES
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$DESTINATION" && sha256sum "$@") > "$DESTINATION/SHA256SUMS"
else
  (cd "$DESTINATION" && shasum -a 256 "$@") > "$DESTINATION/SHA256SUMS"
fi

echo "Backup written to $DESTINATION"
