#!/bin/sh
# 导出数据库、书库根目录和字体归档，并生成恢复清单及校验和；派生缓存不纳入备份。
# Exports the database, library roots and fonts with a recovery manifest and checksums; derived caches are excluded.
# 为数据库及所有持久化 BookKin 文件根目录创建自包含恢复点。缓存属于派生数据，有意不纳入备份。
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

# 数据库导出前先验证字体挂载；挂载缺失时立即失败，避免生成看似有效却不完整的恢复点。
# Validate the font mount before starting the database dump so a missing mount
# fails fast without producing a partial-looking recovery point.
FONT_ROOT=${BOOKKIN_FONT_BACKUP_ROOT:-${BOOKKIN_FONT_STORAGE:-./.local/fonts}}
FONT_REAL=$(canonical_directory "$FONT_ROOT")
ARTICLE_ROOT=${BOOKKIN_ARTICLE_STORAGE:-./.local/content/articles}
VAULT_ROOT=${BOOKKIN_VAULT_STORAGE:-./.local/content/vault}
ARTICLE_REAL=$(canonical_directory "$ARTICLE_ROOT")
VAULT_REAL=$(canonical_directory "$VAULT_ROOT")
FONT_EMBEDDED=false
while IFS= read -r LIBRARY_ROOT; do
  ROOT_REAL=$(canonical_directory "$LIBRARY_ROOT")
  case "$FONT_REAL/" in
    "$ROOT_REAL"|"$ROOT_REAL"/*) FONT_EMBEDDED=true ;;
  esac
done < "$ROOTS_FILE"

DESTINATION_REAL=$(canonical_directory "$DESTINATION")
for CONTENT_ROOT in "$ARTICLE_REAL" "$VAULT_REAL"; do
  case "$DESTINATION_REAL/" in
    "$CONTENT_ROOT/"*) echo "Backup destination must not be inside content storage" >&2; exit 1 ;;
  esac
done
CHECKSUM_FILES="manifest.txt database.dump"

cat > "$DESTINATION/manifest.txt" <<EOF
format=bookkin-backup-v3
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
  # 归档“.”以包含隐藏目录和根目录中的普通书籍文件。符号链接按链接本身归档，tar 不跟随链接。
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

tar -C "$ARTICLE_REAL" -czf "$DESTINATION/articles.tar.gz" .
tar -C "$VAULT_REAL" -czf "$DESTINATION/vault.tar.gz" .
printf 'article-archive=articles.tar.gz\nvault-archive=vault.tar.gz\n' >> "$DESTINATION/manifest.txt"
CHECKSUM_FILES="$CHECKSUM_FILES articles.tar.gz vault.tar.gz"

# 清单本身也参与校验，防止缺少根目录或字体归档的备份被误认作完整备份。
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
