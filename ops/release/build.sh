#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
# A new directory on every build prevents files from a previous release leaking in.
DEST=$(mktemp -d "$ROOT/.artifacts/release-XXXXXXXX")
printf 'Release directory: %s\n' "$DEST"
pnpm lint
pnpm typecheck
pnpm build
rsync -a --exclude target --exclude .local apps/server/ "$DEST/server/"
mkdir -p "$DEST/server/src/main/resources/static"
rsync -a --delete apps/web/dist/client/ "$DEST/server/src/main/resources/static/"
(cd "$DEST/server" && ./mvnw verify)
cp "$DEST/server/target/bookkin-0.1.0-SNAPSHOT.jar" "$DEST/bookkin.jar"
cp ops/release/check.py ops/release/install.sh "$DEST/"
python3 - "$DEST" <<'PY'
import hashlib,json,pathlib,re,subprocess,sys
out=pathlib.Path(sys.argv[1])
source=pathlib.Path('apps/web/src/App.tsx').read_text()
routes=[re.sub(r':[A-Za-z]+','release-check',p) for p in re.findall(r'<Route path="([^"]+)"',source) if p != '*']
(out/'routes.json').write_text(json.dumps(routes,indent=2))
digest=hashlib.sha256((out/'bookkin.jar').read_bytes()).hexdigest()
(out/'SHA256SUMS').write_text(digest+'  bookkin.jar\n')
(out/'release.json').write_text(json.dumps({'jarSha256':digest,'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'workingTreeModified':bool(subprocess.check_output(['git','status','--porcelain'],text=True))},indent=2))
PY
printf 'Ready: %s\n' "$DEST"
