# BookKin 中英双语注释交付 / Bilingual comment delivery

日期 / Date: 2026-10-20 UTC
基线 / Baseline: `aa7dab0737891152f0a7bb0ace05faafc1338f45`

## 结果 / Result

本轮在 **570 个源码文件**增加 **982 处说明或对译**，包括职责、关键边界、数据契约和测试意图。只补注释与本报告，没有重构或修改业务逻辑，也没有推送。

Added **982 explanation/translation blocks across 570 source files**, covering responsibilities, critical boundaries, data contracts and test intent. Only comments and this report changed. No business-code refactor or push occurred.

- 应用源码：347 个手写 Java/TS/TSX 文件中，346 个补注释；仅保留 Vite 类型引用声明原样。包含全部 126 个后端 Java 文件和 220 个前端文件。
- 工具源码：48 个运维、模型构建及几何验证脚本全部补说明。
- 测试与辅助源码：176 个文件补双语场景意图；Sites 宿主测试按仓库规范保持原样。

- Application: 346 of 347 handwritten Java/TS/TSX files annotated, excluding only the Vite type-reference stub. Includes all 126 backend Java and 220 frontend files.
- Tooling: all 48 operational, model-construction and geometry-verification scripts annotated.
- Tests/helpers: 176 files receive bilingual scenario intent. The protected Sites hosting test remains unchanged as required.

这里的 982 是新增说明块，不是“已逐行注释”或“每个方法都有文档”的数量。简单代码避免重复解释；重要路径说明为什么这样处理、失败时如何恢复、哪些条件并未保证。现有测试名称、代码标识符和运行时文档字符串保留原样。

982 counts inserted explanation blocks, not fully documented methods or every line. Notes prioritize reasons, recovery and limits over restating obvious code. Existing test names, identifiers and runtime docstrings are unchanged.

## 重点 / Highlights

1. 初始化、认证与授权：首次主人锁、CSRF、角色边界、注册策略、会话过期/撤销、找回链接与密码要求。
2. 扫描及入库：内容去重、人工字段覆盖边界、流式暂存、异步校对、幂等确认与文件/数据库补偿。
3. NAS 文件安全：预览、指纹复核、根目录与软链接边界、读写租约、移动/回收/恢复及元数据写回。
4. 阅读及隐私：按用户隔离的进度/笔记、退出保存、迟到响应、EPUB/PDF 定位与直接样式更新。
5. 3D：目录身份、碰撞扫掠、流式加载与取消、共享资源所有权、静态批处理、坐标转换及刚性物件锚点。
6. 工具与测试：备份/恢复、发布验证、模型模块拆分、Meshopt 逐字节往返、三角面多重集合保真与失败对照。

The focus covers setup/authentication, ingestion and manual overrides, NAS preview/fingerprint/recovery, private reading state, 3D lifecycle/collision/ownership, and operational/model/test contracts.

## 验证 / Verification

- **逐字节还原通过**：按清单倒序精确移除 982 处新增注释后，570 个源码文件全部还原基线原始字节。变更清单与 Git diff 一致。
- **TypeScript 5.9.3 静态检查通过**：352 个 TS/TSX 解析无错误，去注释后的 JavaScript 输出与基线一致。
- **工具检查通过**：37 个 Python/fragment 的 AST 与基线一致；7 个 Shell 通过语法检查；6 个 MJS 通过 Node 语法检查。
- **后端离线 Maven verify 通过**：134 项中 127 通过，7 跳过，0 失败/错误。4 项因 Docker 不可用跳过；3 项缺少显式测试数据库环境变量。跳过不是通过。
- **运维测试通过**：备份 2 项、发布检查 3 项，使用临时目录、模拟 Docker 和本机临时 HTTP 服务，不执行真实恢复/部署。
- **git diff --check 通过**。补丁以准确基线进行适用性检查。

- Exact byte restoration passes for all 570 changed sources after removing the 982 recorded insertions.
- All 352 TS/TSX files parse and emit identical comment-free JavaScript under TypeScript 5.9.3.
- Python/fragment AST equality: 37; shell syntax: 7; MJS syntax: 6.
- Offline backend verify: 134 total, 127 passed, 7 skipped, no failures/errors. Four skips require Docker; three require the explicit test database environment. Skipped coverage is not passed coverage.
- Five operational tests pass using isolated fixtures; no real restore or deployment runs.
- Whitespace and baseline patch applicability checks pass.

后端使用现有缓存编译工具，编译目标仍为 Java 21，测试在 Java 21 运行。为适配当前环境，Mockito 以测试 JVM 的启动 agent 加载，而不是依赖动态自附加。未改 POM、锁文件、依赖版本或安全配置。

The backend uses cached compiler tooling targeting Java 21 and runs tests on Java 21. Mockito is preloaded as a test-JVM agent instead of relying on dynamic self-attachment. No POM, lockfile, dependency version or security configuration changed.

## 尚未验证的边界 / Remaining verification limits

完整前端 lint/typecheck/test/build 未运行：`ml-matrix@6.15.1` 的依赖发布等待限制截至 2026-10-20 08:15 UTC，本轮未绕过，也未因此修改锁定版本。静态解析/输出一致不能替代完整类型检查、测试或真实浏览器交互。

Full frontend lint/typecheck/test/build remains pending behind the `ml-matrix@6.15.1` release-age restriction through 2026-10-20 08:15 UTC. The restriction was not bypassed and versions were not changed. Parse/emission equality is not full type checking, tests or browser interaction validation.

没有重建 Blender 场景、导出 GLB 或重跑所有几何验收。模型脚本的语法及 AST 验证通过，不代表当前资产已被所有历史验证器验收。部分验证器固定历史 r16/r27 版本或旧物件位置，注释已明确这些限制；未改断言来制造通过。

No Blender rebuild, GLB export or full geometry-verifier rerun was performed. Script syntax/AST checks do not certify current assets against historical verifiers. Some encode r16/r27 revisions or earlier feature placements; comments clarify those limits without changing assertions to manufacture a pass.

## 注释已澄清的既有行为 / Existing behavior clarified

- 普通 `Files.move` 不因阶段名叫 ATOMIC_MOVE 就获得原子性保证。
- 元数据写回保留的是操作级暂存补偿快照，成功后清理，并非持久版本历史。
- 路径根边界检查不是文件锁，也不等同于全面禁止根内软链接。
- 内容响应的读租约为 15 分钟，当前端点不续租；不能宣称任意时长传输都持续受租约保护。
- 扫描和文件 Worker 的调度注解当前读取 `page` 前缀，注释描述实际键而不是猜测的 `bookkin` 配置。
- 历史 Long Room、雕像和验证脚本存在，不代表当前主场景启用它们。

These notes describe existing limits, not fixes: plain moves are not guaranteed atomic; writeback snapshots are temporary; path checks are not locks or a universal symlink ban; content leases expire after 15 minutes without renewal; scheduling uses the actual `page` annotation keys; retained historical components are not necessarily active.

## 保持原样 / Left unchanged

生成 API/主题代码、依赖、模型/图片/字体等资产、配置/锁文件、已发布数据库迁移、Vite 类型引用和明确保护的 Sites 宿主支持文件保持原样。逐文件分类见附带 `coverage-inventory.json`；精确插入记录见 `comment-insertions-final.json`。

Generated API/theme code, dependencies, assets, configuration/locks, published migrations, the Vite type reference and protected Sites hosting files remain unchanged. See the attached coverage inventory and insertion manifest for exact file-level scope.
