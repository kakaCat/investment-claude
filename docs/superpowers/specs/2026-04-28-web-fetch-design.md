# WebFetch Tool 实现设计

**日期**: 2026-04-28
**状态**: 待实现
**参考**: Claude Code `src/tools/WebFetchTool/`

---

## 背景与目标

为 Pi 实现一个网页抓取工具，允许 AI 访问 URL、将 HTML 转为 Markdown，并通过二次模型回答用户对页面内容的问题。对标 Claude Code 的 WebFetchTool，但使用 Node 内置 fetch 替代 axios，去掉域名预检等复杂安全机制。

---

## 文件结构

```
src/tools/WebFetchTool/
├── WebFetchTool.tsx     ← 主工具（fetch + HTML→MD + 二次模型）
├── prompt.ts            ← DESCRIPTION + SEARCH_HINT 常量
└── UI.tsx               ← renderToolUse / renderToolResult Ink 组件
```

**修改文件：**
- `src/tools/index.ts` — import + 注册 WebFetchTool
- `package.json` — 新增 `turndown` + `@types/turndown` 依赖

---

## 工具接口

**tool name:** `web_fetch`

**inputSchema:**

```typescript
{
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'The URL to fetch. Must be http:// or https://.',
    },
    prompt: {
      type: 'string',
      description: 'What to extract or answer from the page content.',
    },
  },
  required: ['url', 'prompt'],
}
```

**返回值:** `Promise<string>` — 二次模型对页面内容的回答；失败时返回错误描述字符串。

**isReadOnly:** `true`

---

## 调用流程

```
call(url, prompt)
  1. 验证 URL（必须 http/https，否则返回错误字符串）
  2. http:// 自动升级为 https://
  3. fetch(url, { signal: AbortSignal.timeout(60_000), headers })
     - User-Agent: pi-agent/0.1
     - Accept: text/html, text/markdown, */*
  4. 响应检查
     - HTTP 4xx/5xx → 返回 "Error: HTTP {status} {statusText}"
  5. 读取 body
     - 超过 10MB → 截断到 10MB
  6. HTML → Markdown（内容类型含 text/html 时）
     - 使用 turndown 转换
     - 超过 100,000 字符 → 截断 + "...(truncated)"
     - 非 HTML（text/plain、text/markdown）直接使用原文
  7. 调用 Anthropic API（claude-haiku-4-5）
     - system: "You are a helpful assistant. Answer the user's question based on the fetched web page content."
     - user: "<page url=\"{url}\">\n{markdown}\n</page>\n\n{prompt}"
     - max_tokens: 4096
  8. 返回模型回答
     - 二次模型调用失败 → 降级返回原始 markdown（不崩溃）
```

---

## 错误处理

| 场景 | 返回值 |
|------|--------|
| 非 http/https URL | `Error: invalid URL - must start with http:// or https://` |
| URL 解析失败 | `Error: invalid URL` |
| fetch 超时（60s） | `Error: fetch timed out after 60s` |
| 网络错误 | `Error: {error.message}` |
| HTTP 4xx/5xx | `Error: HTTP {status} {statusText}` |
| 二次模型失败 | 原始 markdown（降级，不返回错误） |

---

## 二次模型配置

```typescript
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.PI_BASE_URL,
})

const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 4096,
  system: 'You are a helpful assistant. Answer the user\'s question based on the fetched web page content.',
  messages: [
    {
      role: 'user',
      content: `<page url="${url}">\n${markdown}\n</page>\n\n${prompt}`,
    },
  ],
})
```

---

## UI 组件

**`renderToolUse`（工具调用时显示）:**
```
🌐 Fetching: https://example.com
   "What is the main topic of this page?"
```

**`renderToolResult`（结果显示）:**
```
🌐 https://example.com
The main topic is...
```

---

## 依赖

| 包 | 类型 | 用途 |
|----|------|------|
| `turndown` | dependencies | HTML → Markdown 转换 |
| `@types/turndown` | devDependencies | TypeScript 类型 |
| `@anthropic-ai/sdk` | 已有 | 二次模型调用 |

---

## 不在范围内

- 域名预检（CC 的 `api.anthropic.com/api/web/domain_info`）
- 权限系统（询问用户是否允许访问某域名）
- 缓存（LRU cache）
- 跨域重定向保护
- 二进制内容处理（PDF、图片）
