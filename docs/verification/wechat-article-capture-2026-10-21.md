# 微信文章抓取适配

目标链接：`https://mp.weixin.qq.com/s/vIb1GXMen2IvmRjLiANLfA`。

## 原因和方案

本机系统 DNS 将微信域名解析为代理 Fake IP `198.18.0.200`，并返回对应的 IPv4-translatable IPv6 地址。原安全校验拒绝保留网段，且页面约 3.70 MiB，超过旧的 3 MiB HTML 上限。所有异常原先均转换为同一条通用错误。

- 系统解析正常时沿用原来的公网地址校验。仅在检测到 Fake IP 时，通过固定公网 IP 的 HTTPS DNS 服务独立解析，并重新校验所有结果；连接仍以原站域名执行 TLS 证书校验。
- 默认独立解析端点为 AliDNS，Cloudflare 作为后备。不修改操作系统或代理设置，不允许连接 Fake IP、内网或本地地址。每次网页跳转仍重新执行目标检查。
- HTML 上限调整为 8 MiB；图片维持原有 5 MiB 上限、像素限制和净化处理。
- DNS、地址拒绝、超时、HTTP 响应、资源超限和跳转错误分别返回明确提示，不暴露原始内部异常。

公开协议参考：[AliDNS DoH JSON API](https://help.aliyun.com/en/dns/httpdns-doh-json-api)、[Cloudflare DNS JSON](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)。

## 初步验证

- 通过 AliDNS 的真实公网地址直接请求原微信域名，返回 HTTP 200，取得约 3.70 MiB HTML；页面含标题、作者与 `#js_content` 正文。
- DNS 适配、原地址拒绝规则及大页面正文解析的 11 项单元测试通过。

## 最终验收

- 新增传输层 10 项测试通过，覆盖私有地址跳转、数字主机变体、DNS/超时/HTTP 错误、最大字节流读取及跳转次数。
- `apps/server/./mvnw verify` 成功：163 项测试中 154 项通过、9 项依赖 Docker 的数据库测试跳过，0 失败、0 错误。
- 使用 `pnpm start:local` 更新本地 API/Worker 不可变 JAR 快照，健康检查为 UP；未部署线上。
- 实际浏览器从 `/articles` 的“新增文章 → 抓取预览”提交原链接，成功进入导入预览。标题、作者、来源链接正确，正文 25,581 个字符、99 个带稳定 ID 的段落、8 个表格，包含末尾参考资料。
- 当时仅检查普通 `img`，抓取正文为 0 张图片，未出现图片导入失败占位。后续确认漏验了原文内嵌 SVG 流程图与元数据封面；图片验收结果由[后续修复记录](./wechat-article-images-2026-10-22.md)补充，本项不能作为完整图文抓取通过的证据。
- 正文内无 script、iframe、object、embed，浏览器控制台无错误。仅抓取并预览，没有保存文章、提交、推送。

证据：[预览截图](./wechat-article-capture-2026-10-21/import-preview.png)、[测量数据](./wechat-article-capture-2026-10-21/metrics.json)。
