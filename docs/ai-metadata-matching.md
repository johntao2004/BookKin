# BookKin AI 书目匹配

BookKin 的 AI 书目功能只发送 EPUB/PDF 解析出的书名、作者、ISBN、出版社、语言、系列和标签等结构化元数据，不上传整本书内容。AI 输出会进入上传复核页，带有 `需核对` 标记；只有主人或管理员点击采用并确认入库后，才会进入正式书目。

## 支持的平台

主人或管理员可以在“设置 → AI 书目匹配”页面配置多个平台、自动匹配开关、候选数量和超时时间。环境变量仍可提供首次启动时的默认配置；保存页面设置后，以数据库中的设置为准。

服务端通过 `bookkin.ai.providers` 或设置页配置多个平台：

- `OPENAI_COMPATIBLE`：OpenAI、DeepSeek、通义千问、SiliconFlow，以及本地 Ollama 等兼容 `/chat/completions` 的平台。
- `ANTHROPIC`：Anthropic Messages API。
- `GEMINI`：Google Gemini `generateContent` API。

多个平台可以同时启用。自动匹配会按配置顺序查询可用平台，并合并去重候选；复核页的“AI 查找未匹配”也可以通过 API 的 `providerId` 指定单个平台。

设置页按厂商提供模型预设，也允许选择“自定义模型”填写实际模型 ID。DeepSeek 的默认预设为 `deepseek-v4-flash`，另提供 `deepseek-v4-pro`；不再使用已弃用的 `deepseek-chat`。模型列表以各厂商当前公开文档为准： [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing)、[通义千问模型列表](https://help.aliyun.com/zh/model-studio/model-list-text-generation/)、[Google Gemini 模型](https://ai.google.dev/gemini-api/docs/models) 和 [Ollama 模型库](https://ollama.com/library)。

设置页提交的 API 密钥不会回传给浏览器，服务端使用 `BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY` 加密后保存。配置文件没有可用于生产的默认密钥：AI 关闭时可以留空，启用 AI 或保存平台密钥前必须设置实例专属的稳定随机值。`pnpm start:local` 会在 `.local/ai-settings-encryption-key` 生成并复用仅限本机的随机值；生产环境必须通过服务器密钥管理注入，不要把它提交到仓库。更换密钥前先导出并重新录入平台密钥，否则旧密文无法解密。

## 环境变量示例

```text
BOOKKIN_AI_ENABLED=true
BOOKKIN_AI_AUTO_MATCH=true
BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY=请替换成独立随机密钥
BOOKKIN_AI_OPENAI_ENABLED=true
BOOKKIN_AI_OPENAI_API_KEY=...
BOOKKIN_AI_OPENAI_MODEL=gpt-4o-mini

# 也可以同时启用其他平台
BOOKKIN_AI_DEEPSEEK_ENABLED=true
BOOKKIN_AI_DEEPSEEK_API_KEY=...
BOOKKIN_AI_ANTHROPIC_ENABLED=true
BOOKKIN_AI_ANTHROPIC_API_KEY=...
BOOKKIN_AI_GEMINI_ENABLED=true
BOOKKIN_AI_GEMINI_API_KEY=...

# 本地 Ollama 不需要云端密钥
BOOKKIN_AI_OLLAMA_ENABLED=true
BOOKKIN_AI_OLLAMA_MODEL=qwen3
```

默认关闭 AI。没有配置密钥、平台超时或模型返回非 JSON 时，BookKin 会保留本地识别和普通书目服务的结果，不阻断上传入库。
