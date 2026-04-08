# Browser Tool Design

**日期**: 2026-04-08
**状态**: 待实现

---

## 目标

在 pi-claude-code 中实现浏览器自动化工具，支持完整的网页交互（导航、点击、填表、截图），并让模型能通过 vision 能力"看"截图。

---

## Part 1：框架扩展 — ToolResultContent 支持 image block

### 1.1 message.ts

`ToolResultContent.content` 从 `string` 扩展为联合类型，对齐 Anthropic API 格式：

```ts
type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/png'; data: string }
}

type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | ImageBlock>
}
```

### 1.2 Tool.tsx

新增可选方法 `callWithBlocks()`，优先级高于 `call()`：

```ts
callWithBlocks?(input: unknown, context: ToolUseContext): Promise<ToolResultContent['content']>
```

`call()` 签名不变，仍返回 `Promise<string>`。工具只需实现其中一个。

新增 vision 检测工具函数：

```ts
// src/utils/modelCapabilities.ts
export function modelSupportsVision(model: string): boolean
```

按模型名前缀判断：`claude-3`+ 支持，其他不支持。

### 1.3 query.ts

执行工具时：
1. 优先调用 `callWithBlocks()`，否则调用 `call()`
2. 构建 SDK messages 时，若 `ToolResultContent.content` 是 array，检查当前模型是否支持 vision
3. 不支持时过滤掉 image block，只保留 text block（降级）

### 1.4 toolResultStorage.ts

Layer 1/2 budget 逻辑只处理 string content，array content（含 image block）直接透传，不做截断。Layer 2 计算 turn 总大小时，array content 按 0 字符计算（image block 不参与 budget 统计）。

---

## Part 2：BrowserTool

### 2.1 目录结构

```
src/tools/BrowserTool/
├── BrowserTool.tsx   # 工具定义，实现 callWithBlocks
├── browser.ts        # playwright 单例管理
├── prompt.ts         # description + searchHint
└── UI.tsx            # Ink UI
```

### 2.2 Actions

| Action | 参数 | 说明 |
|--------|------|------|
| `navigate` | `url` | 跳转 URL，返回标题 + 文本预览（前 2000 字符） |
| `click` | `selector` | CSS selector 点击，随机延迟模拟人类操作 |
| `fill` | `selector`, `text` | 填写表单字段 |
| `getText` | `selector` | 提取文本，>1000 字符时保存到 session 文件 |
| `getHTML` | — | 获取完整 HTML，保存到 session 文件，返回路径 + 预览 |
| `screenshot` | `path?` | 截图保存到 session 目录，同时返回 base64 给模型 |
| `search` | `text` | Bing 搜索快捷方式，返回结果文本 |
| `connect` | `url?` | 连接已有 Chrome（CDP），默认 `http://localhost:9222` |
| `close` | — | 关闭浏览器，重置单例 |

### 2.3 截图路径

```
~/.pi/sessions/{sessionId}/screenshots/screenshot-{timestamp}.png
```

- 使用 `getSessionId()` 获取 session ID
- 用户可通过 `path` 参数覆盖默认路径
- 截图同时返回：text block（文件路径）+ image block（base64）

### 2.4 浏览器单例

- 进程级单例（`browser` + `page` 变量）
- `headless: false`，注入反检测脚本（同 piagent）
- `close` action 后重置为 null
- `getPage()` 懒初始化，page 关闭时自动重建

### 2.5 依赖

`package.json` 新增：
```json
"playwright": "^1.58.2"
```

### 2.6 工具注册

`src/tools/index.ts` 中导入并加入 `BUILTIN_TOOLS`，设置 `deferLoading: true`（按需加载，不占初始 context）。

---

## 改动文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/types/message.ts` | 扩展 `ToolResultContent.content` 类型 |
| `src/Tool.tsx` | 新增 `callWithBlocks` 可选方法 |
| `src/utils/modelCapabilities.ts` | 新建，vision 检测函数 |
| `src/query.ts` | 支持 `callWithBlocks`，vision 降级逻辑 |
| `src/utils/toolResultStorage.ts` | array content 透传 |
| `src/tools/BrowserTool/BrowserTool.tsx` | 新建 |
| `src/tools/BrowserTool/browser.ts` | 新建 |
| `src/tools/BrowserTool/prompt.ts` | 新建 |
| `src/tools/BrowserTool/UI.tsx` | 新建 |
| `src/tools/index.ts` | 注册 BrowserTool |
| `package.json` | 新增 playwright 依赖 |
