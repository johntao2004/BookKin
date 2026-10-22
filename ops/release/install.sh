#!/usr/bin/env bash
# 锁定发布操作，核验制品与迁移边界，备份数据库并切换 API/Worker 镜像；验收失败时回退应用镜像。
# Locks deployment, checks artifacts and migration boundaries, backs up the database and switches API/Worker images, with application-image rollback on failed checks.
# 在 FNOS 上以 root 身份运行：bash install.sh /vol1/bookkin/releases <version directory>。
# Run on FNOS as root: bash install.sh /vol1/bookkin/releases <version directory>
set -euo pipefail
LIVE=${1:?live compose directory required}
CANDIDATE=$(cd "${2:?candidate directory required}" && pwd)
cd "$LIVE"
exec 9> .release.lock
flock -n 9 || { echo 'Another release is running'; exit 1; }
(cd "$CANDIDATE" && sha256sum -c SHA256SUMS)
HASH=$(sha256sum "$CANDIDATE/bookkin.jar" | cut -c1-16)
IMAGE="bookkin:release-$HASH"
PREVIOUS=$(docker inspect bookkin-app-1 --format '{{.Image}}')
docker image tag "$PREVIOUS" "bookkin:rollback-$HASH"
BASELINE_STATE=$(docker compose exec -T postgres psql -U bookkin -d bookkin -Atc "select count(*)=1 and bool_and(version='1' and type='BASELINE' and success) from flyway_schema_history")
python3 - "$LIVE/bookkin.jar" "$CANDIDATE/bookkin.jar" "${3:-}" "${4:-}" "$BASELINE_STATE" <<'PYCODE'
import hashlib,json,sys,zipfile
def migrations(path):
    with zipfile.ZipFile(path) as z:
        return {n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if '/db/migration/' in n and not n.endswith('/')}
previous, candidate = migrations(sys.argv[1]), migrations(sys.argv[2])
if previous != candidate:
    additions = {k:v for k,v in candidate.items() if k not in previous}
    approved = sys.argv[3] == '--registration-policy-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V8__registration_policy.sql': 'c5cd412275395414bf5f0fd3d54385372d2fcdc07cc76f49ab27efe5acd8bc7e'}
    approved_ai = sys.argv[3] == '--additive-ai-settings-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V9__ai_settings.sql': '82a5d682be2b0faebcb36fa106b45c86db536425608234c0e6593111e7fd0296'}
    approved_ai_refresh = sys.argv[3] == '--refresh-ai-provider-defaults-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V10__refresh_ai_provider_defaults.sql': '2df138db395f8f223a7555255db2442d847c06f007c58a8502d5a1acecc80236'}
    approved_baseline = False
    if sys.argv[3] == '--consolidated-baseline' and sys.argv[5] == 't':
        receipt = json.load(open(sys.argv[4]))
        approved_baseline = receipt.get('applied') is True and receipt.get('restoredUpgradeVerified') is True and candidate == {'BOOT-INF/classes/db/migration/V1__initial_schema.sql': receipt.get('baselineSqlSha256')}
    if not (approved or approved_ai or approved_ai_refresh or approved_baseline):
        raise SystemExit('Schema changed: use a reviewed migration/recovery plan instead of automatic image rollback')
    print('Reviewed schema transition accepted; backup and rollback metadata retained.')
PYCODE
# 仅生成一次并持续复用；已存在加密数据时拒绝替换密钥。
# Generate once, reuse forever. Refuse replacement when encrypted data already exists.
ENCRYPTED=$(docker compose exec -T postgres psql -U bookkin -d bookkin -Atc "SELECT count(*) FROM ai_provider_settings WHERE api_key_ciphertext IS NOT NULL")
python3 "$CANDIDATE/init-secrets.py" "$LIVE/.env" "$ENCRYPTED"
# 构建时不修改正在使用的 JAR；两个服务使用同一不可变镜像。
# Build without modifying the live JAR; both services receive the same immutable image.
printf 'FROM eclipse-temurin:21-jre-noble\nWORKDIR /app\nCOPY --chmod=0644 bookkin.jar /app/bookkin.jar\nENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp/bookkin"\nENTRYPOINT ["java","-jar","/app/bookkin.jar"]\n' > "$CANDIDATE/Dockerfile"
docker build --tag "$IMAGE" "$CANDIDATE"
# 任何新版本启动前先保护数据库状态；不重建数据卷。
# Protect database state before any version starts. Data volumes are never recreated.
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T postgres pg_dump -U bookkin -d bookkin -Fc > "backups/pre-$HASH-$(date -u +%Y%m%dT%H%M%SZ).dump"
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
    { printf 'BEGIN; DELETE FROM flyway_schema_history;\n'; cat "$ROLLBACK_HISTORY"; printf '\nCOMMIT;\n'; } | docker compose exec -T postgres psql -U bookkin -d bookkin -v ON_ERROR_STOP=1 >/dev/null
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
docker tag "$IMAGE" bookkin:local
cp "$CANDIDATE/bookkin.jar" bookkin.jar.next
chmod 644 bookkin.jar.next
mv bookkin.jar.next bookkin.jar
cp "$CANDIDATE/release.json" current-release.json
printf '%s\n' "$CANDIDATE" > current-release-directory
printf 'Accepted release: %s\n' "$IMAGE"
