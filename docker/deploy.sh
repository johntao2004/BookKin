#!/usr/bin/env bash
# Silvae（书林）一键 Docker 部署脚本
# 自动初始化 .env 随机密钥、创建宿主机书库挂载目录并启动全栈容器
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未检测到 docker，请先安装 Docker Desktop 或 Docker Engine。" >&2
  exit 1
fi

rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [[ ! -f .env ]]; then
  umask 077
  cp .env.example .env
  DB_PASS="$(rand_hex 16)"
  AI_KEY="$(rand_hex 32)"
  TFA_KEY="$(rand_hex 32)"
  python3 - .env "$DB_PASS" "$AI_KEY" "$TFA_KEY" <<'PY'
import pathlib, re, sys
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
text = re.sub(r"^POSTGRES_PASSWORD=.*$", f"POSTGRES_PASSWORD={sys.argv[2]}", text, flags=re.M)
text = re.sub(r"^SILVAE_AI_SETTINGS_ENCRYPTION_KEY=.*$", f"SILVAE_AI_SETTINGS_ENCRYPTION_KEY={sys.argv[3]}", text, flags=re.M)
text = re.sub(r"^SILVAE_TWO_FACTOR_ENCRYPTION_KEY=.*$", f"SILVAE_TWO_FACTOR_ENCRYPTION_KEY={sys.argv[4]}", text, flags=re.M)
p.write_text(text, encoding="utf-8")
PY
  echo "已生成 .env 配置文件并自动初始化随机数据库密码与加密密钥。"
fi

LIB_DIR="$(awk -F= '$1=="SILVAE_LIBRARY_MAIN"{print $2}' .env 2>/dev/null | tail -n1)"
LIB_DIR="${LIB_DIR:-./data/library}"
mkdir -p "$LIB_DIR"

HTTP_PORT="$(awk -F= '$1=="SILVAE_HTTP_PORT"{print $2}' .env 2>/dev/null | tail -n1)"
HTTP_PORT="${HTTP_PORT:-8080}"

if [[ "${1:-}" == "--build" ]]; then
  echo "正在从本地构建全栈镜像并启动 Silvae 容器栈..."
  docker compose up -d --build
else
  echo "正在启动 Silvae 容器栈（如本地无预构建镜像将自动构建）..."
  if ! docker compose pull app 2>/dev/null; then
    echo "远程镜像尚未拉取，正在自动切换为本地多阶段构建..."
    docker compose up -d --build
  else
    docker compose up -d
  fi
fi

echo "正在等待 Silvae 服务就绪 (http://localhost:${HTTP_PORT})..."
for ((i=0; i<60; i++)); do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/actuator/health/readiness" 2>/dev/null | grep -q '"UP"'; then
    echo "Silvae 已就绪！请访问：http://localhost:${HTTP_PORT}"
    exit 0
  fi
  sleep 2
done

echo "容器已启动，请通过 'docker compose logs -f app' 查看启动进度。"
