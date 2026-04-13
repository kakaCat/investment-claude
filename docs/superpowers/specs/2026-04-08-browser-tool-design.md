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
  source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string }
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
├── browser.ts        # playwright 连接管理
├── screenshot.ts     # 截图压缩工具函数
├── prompt.ts         # description + searchHint
└── UI.tsx            # Ink UI
```

### 2.2 Actions

**导航与页面理解**

| Action | 参数 | 说明 |
|--------|------|------|
| `connect` | `url?` | 连接已有 Chrome（CDP），默认 `http://localhost:9222`。**推荐首选**，使用用户真实 Chrome，天然绕过反爬 |
| `navigate` | `url` | 跳转 URL，返回标题 + 文本预览（前 2000 字符） |
| `snapshot` | — | 获取页面语义结构（aria snapshot），比 getText/getHTML 更适合模型理解复杂页面，返回可读的 aria 树文本 |
| `getText` | `selector?` | 提取文本，>1000 字符时保存到 session 文件 |
| `getHTML` | — | 获取完整 HTML，保存到 session 文件，返回路径 + 预览 |
| `screenshot` | `selector?`, `fullPage?`, `path?` | 截图压缩后保存到 session 目录，同时返回 base64 给模型。支持全页截图和元素截图 |
| `search` | `text` | Bing 搜索快捷方式，返回结果文本 |

**交互操作**

| Action | 参数 | 说明 |
|--------|------|------|
| `click` | `selector`, `doubleClick?`, `button?`, `modifiers?`, `delayMs?` | 点击元素。`button` 支持 left/right/middle，`modifiers` 支持 Ctrl/Shift/Alt/Meta |
| `fill` | `selector`, `text` | 直接设置输入框 value（快速，适合大多数场景） |
| `type` | `selector`, `text`, `slowly?` | 逐字符模拟键盘输入，触发 keydown/keyup 事件（适合只响应键盘事件的输入框） |
| `pressKey` | `key`, `delayMs?` | 模拟键盘按键，如 `Enter`、`Tab`、`Escape`、`ArrowDown` 等 |
| `hover` | `selector` | 鼠标悬停，触发 hover 状态 |
| `scroll` | `selector` | 滚动元素到可视区域 |
| `evaluate` | `fn` | 在页面上下文执行任意 JS 字符串，返回结果。带超时保护（默认 20s），防止阻塞 playwright 命令队列 |

**等待**

| Action | 参数 | 说明 |
|--------|------|------|
| `wait` | `text?`, `textGone?`, `selector?`, `url?`, `loadState?`, `timeMs?` | 等待条件满足后继续。支持等待文本出现/消失、selector 可见、URL 变化、页面加载状态（load/domcontentloaded/networkidle） |

**会话管理**

| Action | 参数 | 说明 |
|--------|------|------|
| `close` | — | 断开连接，重置状态 |

### 2.3 反爬策略

**首选：connect 模式（用户真实 Chrome）**

用户以调试模式启动 Chrome 后，工具通过 CDP 连接：
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

优势：使用用户真实的 cookie、登录状态、浏览器指纹，无需任何反检测处理，天然绕过 Cloudflare、DataDome 等强反爬。

**备选：自启动模式（无需登录的场景）**

工具自己 launch playwright 浏览器，加入基础反检测：
- `headless: false`
- `--disable-blink-features=AutomationControlled`
- 注入脚本隐藏 `navigator.webdriver`、伪造 `window.chrome`、`navigator.plugins`、`navigator.languages`
- 随机延迟（500-1500ms）模拟人类操作节奏

自启动模式对基础反爬有效，但无法绕过强反爬（Cloudflare 等）。遇到强反爬时，提示用户切换到 connect 模式。

### 2.4 截图处理

参考 openclaw 的 `normalizeBrowserScreenshot()`：

- 截图后自动压缩：最大边 2000px，超出则缩放
- 优先保持 PNG，超过 5MB 时转 JPEG 并降质量
- 支持全页截图（`fullPage: true`）和元素截图（`selector` 指定元素）
- 保存到 `~/.pi/sessions/{sessionId}/screenshots/screenshot-{timestamp}.{ext}`
- 返回两个 block：
  - `{ type: 'text', text: '截图已保存: /path/to/file' }`
  - `{ type: 'image', source: { type: 'base64', media_type: 'image/png|jpeg', data: '...' } }`

### 2.5 snapshot action

使用 playwright 的 `page.accessibility.snapshot()` 获取页面 aria 树，格式化为可读文本返回给模型。适合理解页面结构、定位元素，比 CSS selector 更稳定。

### 2.6 evaluate action

在页面上下文执行任意 JS 字符串。参考 openclaw 的超时保护设计：
- 外层超时（默认 20s）控制整个请求
- 内层在浏览器上下文注入 `Promise.race` 超时，防止 async 函数永久阻塞 playwright 命令队列
- 支持 `abortSignal`，中止时强制断开 playwright 连接

### 2.6 浏览器连接管理

```
browser.ts 维护状态：
- cdpBrowser: Browser | null     — CDP 连接（connect 模式）
- launchedBrowser: Browser | null — 自启动浏览器（备选模式）
- page: Page | null
```

`connect` action 优先，`close` 断开所有连接并重置。`getPage()` 懒初始化，page 关闭时自动重建。

### 2.7 依赖

`package.json` 新增：
```json
"playwright": "^1.58.2"
```

### 2.8 工具注册

`src/tools/index.ts` 中导入并加入 `BUILTIN_TOOLS`，设置 `deferLoading: true`（按需加载，不占初始 context）。

---

## 改动文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/types/message.ts` | 扩展 `ToolResultContent.content` 类型，media_type 支持 jpeg |
| `src/Tool.tsx` | 新增 `callWithBlocks` 可选方法 |
| `src/utils/modelCapabilities.ts` | 新建，vision 检测函数 |
| `src/query.ts` | 支持 `callWithBlocks`，vision 降级逻辑 |
| `src/utils/toolResultStorage.ts` | array content 透传，Layer 2 budget 跳过 image block |
| `src/tools/BrowserTool/BrowserTool.tsx` | 新建 |
| `src/tools/BrowserTool/browser.ts` | 新建，CDP + 自启动双模式 |
| `src/tools/BrowserTool/screenshot.ts` | 新建，截图压缩逻辑 |
| `src/tools/BrowserTool/prompt.ts` | 新建 |
| `src/tools/BrowserTool/UI.tsx` | 新建 |
| `src/tools/index.ts` | 注册 BrowserTool |
| `package.json` | 新增 playwright 依赖 |
