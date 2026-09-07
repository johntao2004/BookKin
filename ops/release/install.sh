#!/usr/bin/env bash
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
python3 - "$LIVE/bookkin.jar" "$CANDIDATE/bookkin.jar" "${3:-}" <<'PYCODE'
import hashlib,sys,zipfile
def migrations(path):
    with zipfile.ZipFile(path) as z:
        return {n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if '/db/migration/' in n and not n.endswith('/')}
previous, candidate = migrations(sys.argv[1]), migrations(sys.argv[2])
if previous != candidate:
    additions = {k:v for k,v in candidate.items() if k not in previous}
    approved = sys.argv[3] == '--registration-policy-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V8__registration_policy.sql': 'c5cd412275395414bf5f0fd3d54385372d2fcdc07cc76f49ab27efe5acd8bc7e'}
    approved_ai = sys.argv[3] == '--additive-ai-settings-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V9__ai_settings.sql': '82a5d682be2b0faebcb36fa106b45c86db536425608234c0e6593111e7fd0296'}
    approved_ai_refresh = sys.argv[3] == '--refresh-ai-provider-defaults-migration' and all(candidate.get(k) == v for k,v in previous.items()) and additions == {'BOOT-INF/classes/db/migration/V10__refresh_ai_provider_defaults.sql': '2df138db395f8f223a7555255db2442d847c06f007c58a8502d5a1acecc80236'}
    if not (approved or approved_ai or approved_ai_refresh):
        raise SystemExit('Schema changed: use a reviewed migration/recovery plan instead of automatic image rollback')
    print('Reviewed additive migration: existing tables unchanged; rollback retains new settings tables.')
PYCODE
# Build without modifying the live JAR; both services receive the same immutable image.
printf 'FROM eclipse-temurin:21-jre-noble\nWORKDIR /app\nCOPY --chmod=0644 bookkin.jar /app/bookkin.jar\nENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp/bookkin"\nENTRYPOINT ["java","-jar","/app/bookkin.jar"]\n' > "$CANDIDATE/Dockerfile"
docker build --tag "$IMAGE" "$CANDIDATE"
# Protect database state before any version starts. Data volumes are never recreated.
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T postgres pg_dump -U bookkin -d bookkin -Fc > "backups/pre-$HASH-$(date -u +%Y%m%dT%H%M%SZ).dump"
OVERRIDE="$CANDIDATE/image.yaml"
printf 'services:\n  app:\n    image: %s\n  worker:\n    image: %s\n' "$IMAGE" "$IMAGE" > "$OVERRIDE"
wait_ready() {
  for ((i=0;i<60;i++)); do
    if curl -fsS http://127.0.0.1/actuator/health/readiness | grep -q '"UP"'; then return 0; fi
    sleep 2
  done
  return 1
}
rollback() {
  echo 'Release check failed; restoring previous application image. Database backup retained.'
  printf 'services:\n  app:\n    image: %s\n  worker:\n    image: %s\n' "$PREVIOUS" "$PREVIOUS" > "$CANDIDATE/rollback.yaml"
  docker compose -f compose.yaml -f "$CANDIDATE/rollback.yaml" up -d --no-build --no-deps app worker
}
# Only unchanged schema or an exact reviewed additive migration is accepted.
# Image rollback retains the additive tables; older code does not access them.
if ! docker compose -f compose.yaml -f "$OVERRIDE" up -d --no-build --no-deps app worker || ! wait_ready || ! python3 "$CANDIDATE/check.py" http://127.0.0.1 --routes "$CANDIDATE/routes.json"; then
  rollback
  exit 1
fi
# Keep the normal compose command on the accepted image after future NAS restarts.
docker tag "$IMAGE" bookkin:local
cp "$CANDIDATE/bookkin.jar" bookkin.jar.next
chmod 644 bookkin.jar.next
mv bookkin.jar.next bookkin.jar
cp "$CANDIDATE/release.json" current-release.json
printf '%s\n' "$CANDIDATE" > current-release-directory
printf 'Accepted release: %s\n' "$IMAGE"
