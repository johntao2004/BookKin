# 运维手册

## NAS 挂载与身份

`BOOKKIN_LIBRARY_MAIN` 必须指向 NAS 上已经挂载的目录。容器以 `BOOKKIN_UID:BOOKKIN_GID` 运行；将二者设为对该目录拥有预期权限的 NAS 用户。Worker 启动时会验证读取、写入、原子移动、暂存目录与剩余空间；验证失败的根目录会降级为只读或离线。

不要将 `.bookkin-trash`、`.bookkin-staging`、`.bookkin-cache` 作为独立书库挂载，也不要让外部整理工具改写这些目录。旧部署遗留的 `.bookkin-versions` 同样不得挂载或手工改写。

多书库使用 Compose override 显式把同一容器路径挂载给 `app` 与 `worker`，并配置同序号的 `BOOKKIN_STORAGE_ROOTS_<N>_NAME/PATH`。仓库提供 [`docker/compose.multi-root.example.yaml`](../docker/compose.multi-root.example.yaml)：

```bash
docker compose -f compose.yaml -f docker/compose.multi-root.example.yaml up --build -d
```

## 启动与升级

```bash
cp .env.example .env
mkdir -p .local/library .local/backups
docker compose up --build -d
docker compose ps
curl --fail http://localhost:8080/actuator/health/readiness
```

升级前执行备份。升级后确认 Flyway 成功、App 健康、Worker 无失败循环，再进行一次小书库扫描和删除/恢复演练。

## 备份与恢复

`ops/backup.sh` 备份 PostgreSQL，以及仍处于保留期的回收站。元数据写回只保留当前文件，原始 EPUB/PDF 应继续由 NAS 自身快照或备份策略保护。
多书库部署需把所有宿主机根目录按固定顺序写入 `BOOKKIN_LIBRARY_BACKUP_ROOTS`（冒号分隔）；备份与恢复必须使用相同顺序。

```bash
BOOKKIN_BACKUP_DIR=/volume/backups ./ops/backup.sh
./ops/restore.sh /volume/backups/20260820T120000Z
```

恢复必须在隔离环境先演练。恢复完成后抽查：用户登录、藏书总数、随机文件指纹与回收站记录。

## 故障处理

- NAS 断连：根目录转为 `OFFLINE`，不要手工把 `MISSING` 批量删除；恢复挂载后重新扫描。
- 空间不足：跨根目录移动在复制前失败，源文件保持不变。清理空间后重新预览，不要直接复用过期任务。
- 指纹冲突：说明外部程序修改了文件。先扫描，再根据新元数据决定是否继续。
- Worker 中断：`PLANNED` 任务可继续；`RUNNING` 任务应先核对源、暂存、目标与回收路径，再由恢复工具重置，禁止直接改状态。
- 写回失败：检查审计记录与 `.bookkin-staging/metadata`；系统只在本次事务期间保存临时回滚文件，失败时恢复原文件，成功后立即删除。

## 十万册性能验收

只在独立测试数据库运行 `tools/seed-large-catalog.sql`；它会写入 10 万本逻辑书和 15 万个文件记录，但不会在磁盘生成书籍。随后使用一个专用测试账户运行：

```bash
docker compose exec -T postgres psql -U "${POSTGRES_USER:-bookkin}" -d "${POSTGRES_DB:-bookkin}" < tools/seed-large-catalog.sql
BOOKKIN_BENCHMARK_USERNAME=benchmark \
BOOKKIN_BENCHMARK_PASSWORD='从环境注入，不写入仓库' \
pnpm benchmark:catalog
```

脚本预热后分别采样列表与模糊搜索，列表 p95 超过 250ms 或搜索 p95 超过 500ms 时返回非零状态。
