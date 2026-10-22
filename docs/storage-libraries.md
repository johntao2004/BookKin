# 三类书库的独立存储

管理设置 → 馆藏管理 → 书库目录分别显示书籍、文章和禁书区存储卡片。只有书籍目录参与 EPUB/PDF 扫描；文章素材和禁书区密文不登记为普通书籍根目录。

| 书库 | 独立主表 | 文件与素材 | 关联数据 |
| --- | --- | --- | --- |
| 书籍 | `books` | 已登记的书籍目录，封面在该目录的 `.bookkin-assets/covers` | `book_files`、普通阅读位置、批注、阅读时长 |
| 文章 | `articles` | 独立文章目录，按上传用户及资源 UUID 保存封面和正文图片 | `article_assets`、`article_asset_links`、`article_reading`、`article_posts` |
| 禁书区 | `vault_objects` | 独立禁书区目录，按用户及资源 UUID 保存加密分块 | `personal_vault`、`vault_chunks`；书名、封面和阅读记录保留在客户端加密数据中 |

三张主表已分别由 V1、V18 迁移建立。此次不新建重复内容表，不改写已发布迁移；辅助表保留各自的外键、版本控制及用户隔离。相同 UUID 可以存在于不同内容表，删除文章不会删除书籍或禁书区对象。

## 本地运行

`pnpm start:local` 保持既有目录，避免升级后丢失引用：

- 书籍：`BOOKKIN_LIBRARY_MAIN`，默认仓库的 `.local/library`。
- 文章：`BOOKKIN_ARTICLE_STORAGE_PATH`，未设置时使用 `${BOOKKIN_CONTENT_STORAGE_PATH}/articles`。
- 禁书区：`BOOKKIN_VAULT_STORAGE_PATH`，未设置时使用 `${BOOKKIN_CONTENT_STORAGE_PATH}/vault`。
- `BOOKKIN_CONTENT_STORAGE_PATH` 默认 `${user.home}/.bookkin/content`。

文章和禁书区的覆盖路径必须是绝对路径，不能相同或互相包含，也不能和书籍目录重叠。启动、目录登记、能力检查和扫描均检查分区边界。应用不会移动已有素材；改变目录配置前应停止写入，完整备份数据库及原目录，复制并校验素材后再切换配置，保留旧目录以便回退。禁止把文章和禁书区目录添加为书籍根目录。

## Compose 与 NAS

API 和 Worker 共享三个独立挂载：

| 宿主配置 | 容器位置 |
| --- | --- |
| `BOOKKIN_LIBRARY_MAIN` | `/library/main` |
| `BOOKKIN_ARTICLE_STORAGE` | `/var/lib/bookkin/content/articles` |
| `BOOKKIN_VAULT_STORAGE` | `/var/lib/bookkin/content/vault` |

旧容器版本可能把文章及密文写入容器用户目录的 `.bookkin/content`。启用新挂载前，必须先导出其中的 `articles` 和 `vault` 子目录、校验后放入对应宿主目录。不要直接重建旧容器后再寻找这些文件。没有旧文件的新安装可直接创建挂载目录。身份验证器实例密钥和禁书区客户端恢复密钥仍须分别备份。

`ops/backup.sh` 的 v3 备份包含数据库、书籍、字体及独立的 `articles.tar.gz`、`vault.tar.gz`，全部参与校验。`ops/restore.sh --dry-run` 验证素材归档；旧 v2 备份仍可校验和恢复其已有内容，但不含文章及禁书区素材。脚本使用 Compose 的宿主目录配置；备份本地原生运行时，应将 `BOOKKIN_ARTICLE_STORAGE` / `BOOKKIN_VAULT_STORAGE` 显式指向实际目录。

管理卡片统一只显示名称、读写状态、可用容量和上次扫描时间，不显示路径、图标、说明或素材类型。文章/禁书区管理接口不返回文件系统路径、对象数量、名称、正文、密钥或阅读记录。容量直接读取当前文件系统；同一磁盘上的目录会显示同一整卷可用容量，并非三个独立配额。V29 的 `content_storage_scans` 只记录目录路径哈希和成功完成的只读目录扫描时间；启动、重新检查和 Worker 定时扫描均实际遍历目录元信息后才更新时间，不解密或读取正文。刷新页面不会伪造扫描时间；失败保留之前成功记录，未扫描显示“尚未扫描”。管理者查看磁盘配置不代表可以解锁其他用户的禁书区。
