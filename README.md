<div align="center">

<img src="docs/assets/silvae-hero-banner.svg" width="100%" alt="Silvae · 书林 — 让好书相聚，让阅读归于自己" />

<br />

[![Docker Build](https://github.com/johntao2004/Silvae/actions/workflows/docker.yml/badge.svg)](https://github.com/johntao2004/Silvae/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-914832.svg?style=flat-square)](LICENSE)
[![3D Ming Library](https://img.shields.io/badge/3D%20Scene-Three.js%20%E8%A7%82%E6%96%87%E8%97%8F%E9%98%81-AE8C57.svg?style=flat-square)](#-观文藏阁--三维明式虚拟书楼)
[![Java 21](https://img.shields.io/badge/Java-21%20%2B%20Spring%20Boot-253B32.svg?style=flat-square)](apps/server/pom.xml)
[![React 19](https://img.shields.io/badge/React-19%20%2B%20TypeScript-5D7D87.svg?style=flat-square)](apps/web/package.json)
[![Docker Ready](https://img.shields.io/badge/Deploy-Docker%20Compose-3B2F2F.svg?style=flat-square)](#-docker-部署)

**[三维书楼](#-观文藏阁--三维明式虚拟书楼) · [阅读与编目](#-阅读与编目体验) · [Docker 部署](#-docker-部署) · [开源许可](#-开源许可)**

</div>

<br />

<div align="center">
  <img src="docs/assets/silvae-pillars.svg" width="100%" alt="Silvae 核心支柱：典藏入林、观文藏阁、各得其所" />
</div>

> **Silvae（书林）** 是一座面向家庭与个人的自托管数字藏书阁。它将散落在 NAS 中的 **EPUB** 与 **PDF** 1:1 映射进两层明代宫殿式三维藏书楼 **「观文藏阁」**，全家人共享同一套书目典藏，而每个人的阅读进度、划线批注与私人笔记则严格按账号隔离。

## 🏯 观文藏阁 · 三维明式虚拟书楼

内置基于 Three.js 打造的 **「观文藏阁 · 二层明式藏书空间」**（`packages/ming-library`），将真实馆藏自动生成可近观、可漫游、可即点即读的三维实体书册，支持第一人称步行漫游、学科分类书架定位、建筑剖视与日光/暮色切换：

<p align="center">
  <img src="docs/assets/screenshots/ming-library-upper.png" width="100%" alt="观文藏阁 · 二层回廊与盘龙藻井" />
</p>

<table>
  <tr>
    <td width="33.3%" align="center">
      <img src="docs/assets/screenshots/ming-library-gate.png" width="100%" alt="宫门入阁 · 文华殿重檐庑殿" />
      <br />
      <sub><b>宫门入阁 · 文华殿重檐庑殿</b></sub>
    </td>
    <td width="33.3%" align="center">
      <img src="docs/assets/screenshots/ming-library-hall.png" width="100%" alt="殿堂书林 · 御座中厅与两翼书架" />
      <br />
      <sub><b>殿堂书林 · 御座中厅与两翼书架</b></sub>
    </td>
    <td width="33.3%" align="center">
      <img src="docs/assets/screenshots/ming-library-shelf.png" width="100%" alt="循架寻书 · 真实书目 1:1 三维陈列" />
      <br />
      <sub><b>循架寻书 · 真实书目 1:1 三维陈列</b></sub>
    </td>
  </tr>
</table>

## 📖 阅读与编目体验

提供 Thema 1.6 国际标准学科分类、在线元数据补全、EPUB / PDF 双引擎纸感阅读器、个人隔离高亮批注、网页文章采集精读与 TOTP 二次验证加密禁书区：

<p align="center">
  <img src="docs/assets/screenshots/catalog-shelf.png" width="100%" alt="Silvae 书架与馆藏编目界面" />
</p>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/screenshots/reader-toc.png" width="100%" alt="EPUB 章节目录导读" />
      <br />
      <sub><b>EPUB 章节目录抽屉与纸感排版</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/screenshots/reader-pdf-spread.png" width="100%" alt="PDF 双页展阅模式" />
      <br />
      <sub><b>PDF 原版版式双页并排展阅</b></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/screenshots/reader-annotations.png" width="100%" alt="高亮划线与私人批注面板" />
      <br />
      <sub><b>多色高亮划线与个人隔离批注</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/screenshots/articles-editor.png" width="100%" alt="文章采集与 Markdown 精读编辑" />
      <br />
      <sub><b>文章文集归档与双栏精读批注</b></sub>
    </td>
  </tr>
</table>

## 🐳 Docker 部署

Silvae 已将 Web 前端、三维明式书楼、Spring Boot API 与后台异步 Worker 完整封装为容器镜像，支持一键启动（无需在宿主机安装 Node.js、Java 或本地数据库）：

### 方式一：一键脚本部署（自动生成随机密钥与目录）

```bash
git clone https://github.com/johntao2004/Silvae.git
cd Silvae
bash docker/deploy.sh
```

### 方式二：标准 Docker Compose 部署

```bash
cp .env.example .env
# 按需修改 .env 中的 SILVAE_LIBRARY_MAIN（指向你的 NAS 书籍目录）与 POSTGRES_PASSWORD
docker compose up -d
```

- **初始化主人账号**：容器就绪后访问 `http://localhost:8080/setup` 创建首个 **主人（Owner）** 账户。
- **常用容器管理**：`pnpm docker:up`（启动）、`pnpm docker:build`（本地构建并启动）、`pnpm docker:logs`（查看日志）、`pnpm docker:down`（停止服务）。

## 📄 开源许可

Silvae 源代码基于 [MIT License](LICENSE) 开源。随附字体与三维场景资产署名详见 [`FONT_SOURCES.md`](apps/web/public/fonts/FONT_SOURCES.md) 与 [`THIRD_PARTY_NOTICES.md`](packages/ming-library/THIRD_PARTY_NOTICES.md)。
