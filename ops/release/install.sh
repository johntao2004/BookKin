#!/usr/bin/env bash
# 锁定发布操作，核验制品与迁移边界，备份数据库并切换 API/Worker 镜像；验收失败时回退应用镜像。
# Locks deployment, checks artifacts and migration boundaries, backs up the database and switches API/Worker images, with application-image rollback on failed checks.
# 在 NAS / Linux 主机上以 root 身份运行：bash install.sh /opt/silvae <version directory>。
# Run on NAS / Linux host as root: bash install.sh /opt/silvae <version directory>
set -euo pipefail
LIVE=${1:?live compose directory required}
CANDIDATE=$(cd "${2:?candidate directory required}" && pwd)
cd "$LIVE"
exec 9> .release.lock
flock -n 9 || { echo 'Another release is running'; exit 1; }
(cd "$CANDIDATE" && sha256sum -c SHA256SUMS)
HASH=$(sha256sum "$CANDIDATE/silvae.jar" | cut -c1-16)
IMAGE="silvae:release-$HASH"
APP_CONTAINER=$(docker compose ps -q app | head -n1)
PREVIOUS=$(docker inspect "$APP_CONTAINER" --format '{{.Image}}')
docker image tag "$PREVIOUS" "silvae:rollback-$HASH"
DB_USER=$(awk -F= '$1=="POSTGRES_USER"{print $2}' .env 2>/dev/null | tail -n1)
DB_NAME=$(awk -F= '$1=="POSTGRES_DB"{print $2}' .env 2>/dev/null | tail -n1)
DB_USER=${DB_USER:-silvae}
DB_NAME=${DB_NAME:-silvae}
LIVE_JAR="$LIVE/silvae.jar"
BASELINE_STATE=$(docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*)=1 and bool_and(version='1' and type='BASELINE' and success) from flyway_schema_history")
python3 - "$LIVE_JAR" "$CANDIDATE/silvae.jar" "${3:-}" "${4:-}" "$BASELINE_STATE" <<'PYCODE'
import hashlib,json,sys,zipfile
def migrations(path):
    with zipfile.ZipFile(path) as z:
        return {n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if '/db/migration/' in n and not n.endswith('/')}
previous, candidate = migrations(sys.argv[1]), migrations(sys.argv[2])
if previous != candidate:
    approved_baseline = False
    if sys.argv[3] == '--consolidated-baseline' and sys.argv[5] == 't':
        receipt = json.load(open(sys.argv[4]))
        approved_baseline = receipt.get('applied') is True and receipt.get('restoredUpgradeVerified') is True and candidate.get('BOOT-INF/classes/db/migration/V1__initial_schema.sql') == receipt.get('baselineSqlSha256')
    if not approved_baseline:
        raise SystemExit('Schema changed: use a reviewed migration/recovery plan instead of automatic image rollback')
    print('Reviewed schema transition accepted; backup and rollback metadata retained.')
PYCODE
# 仅生成一次并持续复用；已存在加密数据时拒绝替换密钥。
# Generate once, reuse forever. Refuse replacement when encrypted data already exists.
ENCRYPTED=$(docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT count(*) FROM ai_provider_settings WHERE api_key_ciphertext IS NOT NULL")
TWO_FACTOR_ENCRYPTED=$(docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT (SELECT count(*) FROM user_two_factor WHERE secret_ciphertext IS NOT NULL) + (SELECT count(*) FROM personal_vault WHERE key_ciphertext IS NOT NULL)")
python3 "$CANDIDATE/init-secrets.py" "$LIVE/.env" "$ENCRYPTED" "$TWO_FACTOR_ENCRYPTED"
# 构建时不修改正在使用的 JAR；两个服务使用同一不可变镜像。
# Build without modifying the live JAR; both services receive the same immutable image.
printf 'FROM eclipse-temurin:21-jre-noble\nWORKDIR /app\nCOPY --chmod=0644 silvae.jar /app/silvae.jar\nENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp/silvae"\nENTRYPOINT ["java","-jar","/app/silvae.jar"]\n' > "$CANDIDATE/Dockerfile"
docker build --tag "$IMAGE" "$CANDIDATE"
# 任何新版本启动前先保护数据库状态；不重建数据卷。
# Protect database state before any version starts. Data volumes are never recreated.
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "backups/pre-$HASH-$(date -u +%Y%m%dT%H%M%SZ).dump"
OVERRIDE="$CANDIDATE/image.yaml"
printf 'services:\n  app:\n    image: %s\n  worker:\n    image: %s\n' "$IMAGE" "$IMAGE" > "$OVERRIDE"
ROLLBACK_HISTORY=""
if [[ "${3:-}" == '--consolidated-baseline' ]]; then
  ROLLBACK_HISTORY=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["rollbackHistory"])' "${4:?baseline receipt required}")
  test -s "$ROLLBACK_HISTORY"
fi
wait_ready() {
  for ((i=0;i<60;i++)); do
    if curl -fsS http://127.0.0.1/actuator/health/readiness | grep -q '"UP"'; then return 0; fi
    sleep 2
  done
  return 1
}
rollback() {
  echo 'Release check failed; restoring previous application image. Database backup retained.'
  if [[ -n "$ROLLBACK_HISTORY" ]]; then
    { printf 'BEGIN; DELETE FROM flyway_schema_history;\n'; cat "$ROLLBACK_HISTORY"; printf '\nCOMMIT;\n'; } | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null
  fi
  printf 'services:\n  app:\n    image: %s\n  worker:\n    image: %s\n' "$PREVIOUS" "$PREVIOUS" > "$CANDIDATE/rollback.yaml"
  docker compose -f compose.yaml -f "$CANDIDATE/rollback.yaml" up -d --no-build --no-deps app worker
}
# 仅接受未变化的数据库结构，或与已审阅内容精确一致的新增式迁移。镜像回滚保留新增表，旧代码不会访问这些表。
# Only unchanged schema or an exact reviewed additive migration is accepted.
# Image rollback retains the additive tables; older code does not access them.
if ! docker compose -f compose.yaml -f "$OVERRIDE" up -d --no-build --no-deps app worker || ! wait_ready || ! python3 "$CANDIDATE/check.py" http://127.0.0.1 --routes "$CANDIDATE/routes.json"; then
  rollback
  exit 1
fi
# 确保 NAS 后续重启时，普通 Compose 命令仍使用已验收镜像。
# Keep the normal compose command on the accepted image after future NAS restarts.
docker tag "$IMAGE" silvae:local
cp "$CANDIDATE/silvae.jar" silvae.jar.next
chmod 644 silvae.jar.next
mv silvae.jar.next silvae.jar
cp "$CANDIDATE/release.json" current-release.json
printf '%s\n' "$CANDIDATE" > current-release-directory
printf 'Accepted release: %s\n' "$IMAGE"
