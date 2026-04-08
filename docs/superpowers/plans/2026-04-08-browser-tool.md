# Browser Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展框架支持 image block 工具结果，并实现完整的浏览器自动化工具（BrowserTool）。

**Architecture:** 分两阶段：Phase 1 扩展 `ToolResultContent` 类型和 `Tool` 接口，让工具可以返回 image block；Phase 2 实现 BrowserTool，通过 CDP 连接用户真实 Chrome 或自启动 playwright 浏览器，支持导航、交互、截图等 15 个 action。

**Tech Stack:** TypeScript, playwright, sharp（图片压缩）, Ink（React CLI UI）

---

## File Map

**Phase 1 — 框架扩展**

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/message.ts` | 修改 | 扩展 `ToolResultContent.content` 支持 image block |
| `src/Tool.tsx` | 修改 | 新增 `callWithBlocks` 可选方法；`ToolDef` 同步更新 |
| `src/utils/modelCapabilities.ts` | 新建 | `modelSupportsVision(model)` 函数 |
| `src/query.ts` | 修改 | 优先调用 `callWithBlocks`；vision 降级逻辑 |
| `src/utils/toolResultStorage.ts` | 修改 | array content 透传；Layer 2 budget 跳过 image block |

**Phase 2 — BrowserTool**

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/tools/BrowserTool/browser.ts` | 新建 | playwright 连接管理（CDP + 自启动双模式），单例 page |
| `src/tools/BrowserTool/screenshot.ts` | 新建 | 截图压缩：缩放到 2000px，超 5MB 转 JPEG |
| `src/tools/BrowserTool/prompt.ts` | 新建 | description + searchHint 字符串 |
| `src/tools/BrowserTool/BrowserTool.tsx` | 新建 | 工具定义，实现 `callWithBlocks`，dispatch 所有 action |
| `src/tools/BrowserTool/UI.tsx` | 新建 | Ink UI：展示当前 action + URL |
| `src/tools/index.ts` | 修改 | import BrowserTool，加入 BUILTIN_TOOLS |
| `package.json` | 修改 | 新增 `playwright`、`sharp` 依赖 |

---

## Phase 1 — 框架扩展

### Task 1: 扩展 ToolResultContent 类型

**Files:**
- Modify: `src/types/message.ts`

- [ ] **Step 1: 修改 `ToolResultContent` 类型**

```ts
// src/types/message.ts — 替换现有 ImageBlock + ToolResultContent 定义
export type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string }
}

export type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | ImageBlock>
}
```

- [ ] **Step 2: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误（联合类型是 `string` 的超集，现有代码兼容）

- [ ] **Step 3: Commit**

```bash
git add src/types/message.ts
git commit -m "feat(types): extend ToolResultContent to support image blocks"
```

---

### Task 2: 新增 modelCapabilities 工具函数

**Files:**
- Create: `src/utils/modelCapabilities.ts`
- Create: `src/utils/__tests__/modelCapabilities.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/utils/__tests__/modelCapabilities.test.ts
import { describe, it, expect } from 'vitest'
import { modelSupportsVision } from '../modelCapabilities.js'

describe('modelSupportsVision', () => {
  it('returns true for claude-3 models', () => {
    expect(modelSupportsVision('claude-3-opus-20240229')).toBe(true)
    expect(modelSupportsVision('claude-3-5-sonnet-20241022')).toBe(true)
    expect(modelSupportsVision('claude-3-haiku-20240307')).toBe(true)
  })
  it('returns true for claude-sonnet-4-6 and similar', () => {
    expect(modelSupportsVision('claude-sonnet-4-6')).toBe(true)
    expect(modelSupportsVision('claude-opus-4-6')).toBe(true)
    expect(modelSupportsVision('claude-haiku-4-5-20251001')).toBe(true)
  })
  it('returns false for unknown models', () => {
    expect(modelSupportsVision('gpt-4')).toBe(false)
    expect(modelSupportsVision('')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/utils/__tests__/modelCapabilities.test.ts
```

Expected: FAIL — `Cannot find module '../modelCapabilities.js'`

- [ ] **Step 3: 实现**

```ts
// src/utils/modelCapabilities.ts
/**
 * 判断模型是否支持 vision（image block in tool_result）。
 * claude-3+ 及 claude-opus/sonnet/haiku 系列均支持。
 */
export function modelSupportsVision(model: string): boolean {
  return /^claude-(3|opus|sonnet|haiku)/.test(model)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/utils/__tests__/modelCapabilities.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/modelCapabilities.ts src/utils/__tests__/modelCapabilities.test.ts
git commit -m "feat(utils): add modelSupportsVision capability check"
```

---

### Task 3: 扩展 Tool 接口，新增 callWithBlocks

**Files:**
- Modify: `src/Tool.tsx`

- [ ] **Step 1: 在文件顶部补充 import**

在 `src/Tool.tsx` 现有 import 后追加：

```ts
import type { ToolResultContent } from './types/message.js'
```

- [ ] **Step 2: 在 `Tool` 接口的 `call` 方法后新增 `callWithBlocks`**

```ts
  /** 执行工具，返回结果字符串 */
  call(input: unknown, context: ToolUseContext): Promise<string>
  /**
   * 执行工具，返回 text/image block 数组（用于截图等需要返回图片的工具）。
   * 优先级高于 call()。未实现时框架回退到 call()。
   */
  callWithBlocks?(input: unknown, context: ToolUseContext): Promise<ToolResultContent['content']>
```

- [ ] **Step 3: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误（`callWithBlocks` 是可选方法，`ToolDef` 的 `Partial<Omit<...>>` 自动包含）

- [ ] **Step 4: Commit**

```bash
git add src/Tool.tsx
git commit -m "feat(Tool): add optional callWithBlocks method for image results"
```

---

### Task 4: 更新 toolResultStorage — array content 透传

**Files:**
- Modify: `src/utils/toolResultStorage.ts`

- [ ] **Step 1: 写测试（新建或追加到已有测试文件）**

```ts
// src/utils/__tests__/toolResultStorage.array.test.ts
import { describe, it, expect } from 'vitest'
import { enforceToolResultBudget, createContentReplacementState } from '../toolResultStorage.js'
import type { Message } from '../../types/message.js'

describe('enforceToolResultBudget — array content', () => {
  it('passes through array content without modification', async () => {
    const messages: Message[] = [
      {
        type: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'id1',
            content: [
              { type: 'text', text: 'screenshot saved' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      },
    ]
    const state = createContentReplacementState()
    const result = await enforceToolResultBudget(messages, state)
    const tr = (result[0] as any).content[0]
    expect(Array.isArray(tr.content)).toBe(true)
    expect(tr.content).toHaveLength(2)
  })

  it('array content counts as 0 toward budget', async () => {
    // 200_001 chars string + array content — only string should trigger budget
    const bigString = 'x'.repeat(200_001)
    const messages: Message[] = [
      {
        type: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'id1', content: bigString },
          {
            type: 'tool_result',
            tool_use_id: 'id2',
            content: [{ type: 'text', text: 'small' }],
          },
        ],
      },
    ]
    const state = createContentReplacementState()
    const result = await enforceToolResultBudget(messages, state)
    // id2 (array) should be untouched
    const tr2 = (result[0] as any).content[1]
    expect(Array.isArray(tr2.content)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/utils/__tests__/toolResultStorage.array.test.ts
```

Expected: FAIL — TypeScript 类型错误（`content` 类型不匹配）

- [ ] **Step 3: 修改 `effectiveSize` 函数**

在 `src/utils/toolResultStorage.ts` 中，将：

```ts
  const effectiveSize = (tr: ToolResultContent): number =>
    replacementMap.get(tr.tool_use_id)?.length ?? tr.content.length
```

改为：

```ts
  const effectiveSize = (tr: ToolResultContent): number => {
    if (Array.isArray(tr.content)) return 0
    return replacementMap.get(tr.tool_use_id)?.length ?? (tr.content as string).length
  }
```

- [ ] **Step 4: 修改 `fresh` 过滤逻辑，跳过 array content**

将：

```ts
  const fresh = toolResults
    .filter(tr => !state.seenIds.has(tr.tool_use_id) && !replacementMap.has(tr.tool_use_id))
    .sort((a, b) => b.content.length - a.content.length)
```

改为：

```ts
  const fresh = toolResults
    .filter(tr =>
      !Array.isArray(tr.content) &&
      !state.seenIds.has(tr.tool_use_id) &&
      !replacementMap.has(tr.tool_use_id),
    )
    .sort((a, b) => (b.content as string).length - (a.content as string).length)
```

- [ ] **Step 5: 修改 `applyReplacements`，跳过 array content**

将：

```ts
  const newContent = user.content.map(c => {
    if (c.type !== 'tool_result') return c
    const replacement = replacementMap.get(c.tool_use_id)
    if (replacement === undefined) return c
    return { ...c, content: replacement }
  })
```

改为：

```ts
  const newContent = user.content.map(c => {
    if (c.type !== 'tool_result') return c
    if (Array.isArray(c.content)) return c
    const replacement = replacementMap.get(c.tool_use_id)
    if (replacement === undefined) return c
    return { ...c, content: replacement }
  })
```

- [ ] **Step 6: 运行测试确认通过**

```bash
npx vitest run src/utils/__tests__/toolResultStorage.array.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/toolResultStorage.ts src/utils/__tests__/toolResultStorage.array.test.ts
git commit -m "feat(toolResultStorage): pass through array content, skip image blocks in budget"
```

---

### Task 5: 更新 query.ts — callWithBlocks + vision 降级

**Files:**
- Modify: `src/query.ts`

- [ ] **Step 1: 在 `executeTools` 中，将工具执行逻辑替换为优先调用 `callWithBlocks`**

找到 `src/query.ts` 中的工具执行段（约第 301-344 行）：

```ts
    const tool = findTool(c.name, tools)
    let result: string
    if (!tool) {
      result = `Error: tool "${c.name}" not found`
    } else {
      try {
        result = await tool.call(c.input, context)
        result = await processToolResult(...)
        ...
      } catch (err) { ... }
    }
    toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: result })
    yield { type: 'tool_result', tool_use_id: c.id, content: result }
```

替换为：

```ts
    const tool = findTool(c.name, tools)
    let toolContent: ToolResultContent['content']
    if (!tool) {
      toolContent = `Error: tool "${c.name}" not found`
    } else {
      try {
        if (tool.callWithBlocks) {
          toolContent = await tool.callWithBlocks(c.input, context)
        } else {
          const raw = await tool.call(c.input, context)
          toolContent = await processToolResult(
            c.id,
            c.name,
            raw,
            tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS,
          )
        }
        const resultStr = Array.isArray(toolContent)
          ? toolContent.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('\n')
          : toolContent
        await executeHooks(
          {
            hook_event_name: 'PostToolUse',
            tool_name: c.name,
            tool_input: c.input,
            tool_response: resultStr,
            session_id: sessionId,
            cwd: context.cwd,
          },
          { matcherQuery: c.name, signal: context.abortSignal },
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        toolContent = `Error: ${errMsg}`
        await executeHooks(
          {
            hook_event_name: 'PostToolUseFailure',
            tool_name: c.name,
            tool_input: c.input,
            tool_error: errMsg,
            session_id: sessionId,
            cwd: context.cwd,
          },
          { matcherQuery: c.name, signal: context.abortSignal },
        )
      }
    }
    toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: toolContent })
    const yieldContent = Array.isArray(toolContent)
      ? toolContent.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('\n')
      : toolContent
    yield { type: 'tool_result', tool_use_id: c.id, content: yieldContent }
```

- [ ] **Step 2: 在文件顶部补充 import**

```ts
import type { ToolResultContent } from './types/message.js'
import { modelSupportsVision } from './utils/modelCapabilities.js'
```

- [ ] **Step 3: 在 `toSDKMessages` 中，构建 tool_result 时过滤不支持 vision 的 image block**

找到 `toSDKMessages` 函数，在 map 逻辑中处理 tool_result content：

```ts
function toSDKMessages(messages: Message[], model: string): Anthropic.MessageParam[] {
  const supportsVision = modelSupportsVision(model)
  return messages
    .filter(...)
    .map((msg) => {
      if (msg.type === 'user') {
        const content = msg.content.map(c => {
          if (c.type !== 'tool_result') return c
          if (!Array.isArray(c.content)) return c
          // 不支持 vision 时过滤掉 image block，只保留 text block
          const filtered = supportsVision
            ? c.content
            : c.content.filter(b => b.type === 'text')
          return { ...c, content: filtered.length > 0 ? filtered : 'No text content available.' }
        })
        if (msg.uuid && !msg.isMeta) {
          const shortId = registerMessageId(msg.uuid)
          return { role: 'user' as const, content: appendIdTag(content as Anthropic.MessageParam['content'], shortId) }
        }
        return { role: 'user' as const, content: content as Anthropic.MessageParam['content'] }
      }
      return {
        role: msg.type as 'user' | 'assistant',
        content: msg.content as Anthropic.MessageParam['content'],
      }
    })
}
```

注意：`toSDKMessages` 现在需要接收 `model` 参数，需要在所有调用处传入 model。

- [ ] **Step 4: 更新 `streamOneTurn` 中的 `toSDKMessages` 调用**

```ts
const sdkMessages = toSDKMessages(messages, model)
```

- [ ] **Step 5: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/query.ts
git commit -m "feat(query): support callWithBlocks, vision degradation for non-vision models"
```

---

## Phase 2 — BrowserTool

### Task 6: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 playwright 和 sharp**

```bash
npm install playwright sharp
npm install --save-dev @types/sharp
```

- [ ] **Step 2: 安装 playwright 浏览器二进制（备选模式用）**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add playwright and sharp dependencies"
```

---

### Task 7: browser.ts — 连接管理

**Files:**
- Create: `src/tools/BrowserTool/browser.ts`

- [ ] **Step 1: 实现**

```ts
// src/tools/BrowserTool/browser.ts
import { chromium, type Browser, type Page } from 'playwright'

// 进程级单例
let _cdpBrowser: Browser | null = null      // connect 模式
let _launchedBrowser: Browser | null = null // 自启动模式
let _page: Page | null = null

/**
 * 连接用户已有 Chrome（CDP 模式）。
 * 用户需先以 --remote-debugging-port=9222 启动 Chrome。
 */
export async function connectCDP(url = 'http://localhost:9222'): Promise<string> {
  await closeAll()
  _cdpBrowser = await chromium.connectOverCDP(url)
  const contexts = _cdpBrowser.contexts()
  const pages = contexts.flatMap(ctx => ctx.pages())
  _page = pages[0] ?? await contexts[0]?.newPage() ?? null
  const title = _page ? await _page.title() : '(no page)'
  return `Connected to Chrome via CDP at ${url}. Current page: ${title}`
}

/**
 * 获取当前 page，不存在时自启动 playwright 浏览器（备选模式）。
 */
export async function getPage(): Promise<Page> {
  if (_page && !_page.isClosed()) return _page

  if (!_launchedBrowser) {
    _launchedBrowser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    })
    // 注入反检测脚本
    const ctx = await _launchedBrowser.newContext()
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      // @ts-ignore
      window.chrome = { runtime: {} }
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] })
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] })
    })
    _page = await ctx.newPage()
  } else {
    const ctx = _launchedBrowser.contexts()[0]
    if (!ctx) throw new Error('Browser context lost')
    _page = await ctx.newPage()
  }

  return _page
}

/** 断开所有连接，重置状态 */
export async function closeAll(): Promise<void> {
  _page = null
  if (_cdpBrowser) {
    await _cdpBrowser.close().catch(() => {})
    _cdpBrowser = null
  }
  if (_launchedBrowser) {
    await _launchedBrowser.close().catch(() => {})
    _launchedBrowser = null
  }
}

/** 当前连接模式 */
export function getConnectionMode(): 'cdp' | 'launched' | 'none' {
  if (_cdpBrowser) return 'cdp'
  if (_launchedBrowser) return 'launched'
  return 'none'
}
```

- [ ] **Step 2: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/tools/BrowserTool/browser.ts
git commit -m "feat(BrowserTool): add browser connection manager (CDP + launched modes)"
```

---

### Task 8: screenshot.ts — 截图压缩

**Files:**
- Create: `src/tools/BrowserTool/screenshot.ts`

- [ ] **Step 1: 写测试**

```ts
// src/tools/BrowserTool/__tests__/screenshot.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeBrowserScreenshot } from '../screenshot.js'
import sharp from 'sharp'

describe('normalizeBrowserScreenshot', () => {
  it('returns small PNG unchanged', async () => {
    // 1x1 PNG
    const buf = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .png().toBuffer()
    const result = await normalizeBrowserScreenshot(buf)
    expect(result.contentType).toBeUndefined()
    expect(result.buffer.length).toBeLessThanOrEqual(buf.length + 100)
  })

  it('resizes large image to max 2000px side', async () => {
    const buf = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#fff' } })
      .png().toBuffer()
    const result = await normalizeBrowserScreenshot(buf)
    const meta = await sharp(result.buffer).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2000)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/tools/BrowserTool/__tests__/screenshot.test.ts
```

Expected: FAIL — `Cannot find module '../screenshot.js'`

- [ ] **Step 3: 实现**

```ts
// src/tools/BrowserTool/screenshot.ts
import sharp from 'sharp'

const MAX_SIDE = 2000
const MAX_BYTES = 5 * 1024 * 1024

export async function normalizeBrowserScreenshot(
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType?: 'image/jpeg' }> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const maxDim = Math.max(w, h)

  // 尺寸和大小都在限制内，直接返回
  if (buffer.byteLength <= MAX_BYTES && maxDim <= MAX_SIDE) {
    return { buffer }
  }

  // 缩放后尝试 JPEG 压缩
  const qualities = [90, 75, 60, 45]
  for (const quality of qualities) {
    const out = await sharp(buffer)
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer()
    if (out.byteLength <= MAX_BYTES) {
      return { buffer: out, contentType: 'image/jpeg' }
    }
  }

  // 最低质量兜底
  const fallback = await sharp(buffer)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 30 })
    .toBuffer()
  return { buffer: fallback, contentType: 'image/jpeg' }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/tools/BrowserTool/__tests__/screenshot.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/BrowserTool/screenshot.ts src/tools/BrowserTool/__tests__/screenshot.test.ts
git commit -m "feat(BrowserTool): add screenshot compression utility"
```

---

### Task 9: prompt.ts

**Files:**
- Create: `src/tools/BrowserTool/prompt.ts`

- [ ] **Step 1: 实现**

```ts
// src/tools/BrowserTool/prompt.ts
export const BROWSER_DESCRIPTION = `Control a web browser to navigate pages, interact with elements, take screenshots, and extract content.

Supports two connection modes:
- CDP mode (recommended): connect to user's existing Chrome with real cookies/login state, bypasses anti-bot protection
- Launched mode (fallback): auto-launch a Chromium browser with basic anti-detection

Actions:
- connect: Connect to existing Chrome via CDP (start Chrome with --remote-debugging-port=9222)
- navigate: Go to a URL, returns page title + text preview
- snapshot: Get page accessibility tree (aria snapshot) — best for understanding page structure
- screenshot: Take screenshot, returns image to model + saves to session dir
- click: Click an element (supports doubleClick, right-click, modifier keys)
- fill: Set input value directly (fast)
- type: Type text character by character (for sites that need keyboard events)
- pressKey: Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)
- hover: Hover over an element
- scroll: Scroll element into view
- wait: Wait for text/selector/URL/load state
- evaluate: Execute JavaScript in page context
- getText: Extract text from element or page
- getHTML: Get full page HTML, saved to session file
- search: Quick Bing search
- close: Disconnect and reset`

export const BROWSER_SEARCH_HINT =
  'browser web navigate click screenshot scrape automation playwright CDP chrome'
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/BrowserTool/prompt.ts
git commit -m "feat(BrowserTool): add tool description and search hint"
```

---

### Task 10: UI.tsx

**Files:**
- Create: `src/tools/BrowserTool/UI.tsx`

- [ ] **Step 1: 实现**

```tsx
// src/tools/BrowserTool/UI.tsx
import React from 'react'
import { Text } from 'ink'

type BrowserInput = {
  action: string
  url?: string
  selector?: string
  text?: string
  key?: string
  fn?: string
}

export function BrowserToolUseUI({ input }: { input: BrowserInput }) {
  const { action, url, selector, text, key } = input
  const detail = url ?? selector ?? text ?? key ?? ''
  return (
    <Text color="cyan">
      🌐 browser:{action}
      {detail ? <Text color="gray"> {detail.slice(0, 80)}</Text> : null}
    </Text>
  )
}

export function BrowserToolResultUI({ result }: { result: string }) {
  const display = result.length > 300 ? result.slice(0, 300) + '…' : result
  return <Text color="gray">{display}</Text>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/BrowserTool/UI.tsx
git commit -m "feat(BrowserTool): add Ink UI components"
```

---

### Task 11: BrowserTool.tsx — 核心实现

**Files:**
- Create: `src/tools/BrowserTool/BrowserTool.tsx`

- [ ] **Step 1: 实现（导航 + 页面理解 actions）**

```tsx
// src/tools/BrowserTool/BrowserTool.tsx
import React from 'react'
import { join } from 'path'
import { homedir } from 'os'
import { mkdir, writeFile } from 'fs/promises'
import { buildTool } from '../../Tool.js'
import { getSessionId } from '../../bootstrap/state.js'
import type { ToolResultContent } from '../../types/message.js'
import { connectCDP, getPage, closeAll } from './browser.js'
import { normalizeBrowserScreenshot } from './screenshot.js'
import { BROWSER_DESCRIPTION, BROWSER_SEARCH_HINT } from './prompt.js'
import { BrowserToolUseUI, BrowserToolResultUI } from './UI.js'

function getScreenshotDir(): string {
  return join(homedir(), '.pi', 'sessions', getSessionId(), 'screenshots')
}

function getSessionFileDir(): string {
  return join(homedir(), '.pi', 'sessions', getSessionId(), 'browser')
}

async function handleAction(input: Record<string, unknown>): Promise<ToolResultContent['content']> {
  const action = String(input.action ?? '')

  // ── connect ──────────────────────────────────────────────────────────────────
  if (action === 'connect') {
    const url = input.url ? String(input.url) : 'http://localhost:9222'
    const msg = await connectCDP(url)
    return msg
  }

  // ── close ────────────────────────────────────────────────────────────────────
  if (action === 'close') {
    await closeAll()
    return 'Browser disconnected.'
  }

  // ── navigate ─────────────────────────────────────────────────────────────────
  if (action === 'navigate') {
    const url = String(input.url ?? '')
    if (!url) throw new Error('navigate requires url')
    const page = await getPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const title = await page.title()
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    const preview = text.slice(0, 2000)
    return `Title: ${title}\n\n${preview}${text.length > 2000 ? '\n...(truncated)' : ''}`
  }

  // ── snapshot ─────────────────────────────────────────────────────────────────
  if (action === 'snapshot') {
    const page = await getPage()
    const snapshot = await page.accessibility.snapshot()
    if (!snapshot) return 'No accessibility snapshot available.'
    return JSON.stringify(snapshot, null, 2).slice(0, 8000)
  }

  // ── getText ───────────────────────────────────────────────────────────────────
  if (action === 'getText') {
    const page = await getPage()
    const selector = input.selector ? String(input.selector) : null
    const text = selector
      ? await page.locator(selector).first().innerText({ timeout: 8000 })
      : await page.evaluate(() => document.body?.innerText ?? '')
    if (text.length <= 1000) return text
    const dir = getSessionFileDir()
    await mkdir(dir, { recursive: true })
    const filepath = join(dir, `text-${Date.now()}.txt`)
    await writeFile(filepath, text, 'utf-8')
    return `Text saved to: ${filepath}\n\nPreview:\n${text.slice(0, 1000)}\n...(${text.length} chars total)`
  }

  // ── getHTML ───────────────────────────────────────────────────────────────────
  if (action === 'getHTML') {
    const page = await getPage()
    const html = await page.content()
    const dir = getSessionFileDir()
    await mkdir(dir, { recursive: true })
    const filepath = join(dir, `html-${Date.now()}.html`)
    await writeFile(filepath, html, 'utf-8')
    return `HTML saved to: ${filepath}\n\nPreview:\n${html.slice(0, 1000)}\n...(${html.length} chars total)`
  }

  // ── search ────────────────────────────────────────────────────────────────────
  if (action === 'search') {
    const query = String(input.text ?? '')
    if (!query) throw new Error('search requires text')
    const page = await getPage()
    await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' })
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    return text.slice(0, 3000)
  }

  // ── screenshot ────────────────────────────────────────────────────────────────
  if (action === 'screenshot') {
    const page = await getPage()
    const selector = input.selector ? String(input.selector) : null
    const fullPage = Boolean(input.fullPage)
    let rawBuffer: Buffer
    if (selector) {
      rawBuffer = await page.locator(selector).first().screenshot()
    } else {
      rawBuffer = await page.screenshot({ fullPage })
    }
    const { buffer, contentType } = await normalizeBrowserScreenshot(rawBuffer)
    const ext = contentType === 'image/jpeg' ? 'jpg' : 'png'
    const mediaType = (contentType ?? 'image/png') as 'image/png' | 'image/jpeg'
    const dir = getScreenshotDir()
    await mkdir(dir, { recursive: true })
    const customPath = input.path ? String(input.path) : null
    const filepath = customPath ?? join(dir, `screenshot-${Date.now()}.${ext}`)
    await writeFile(filepath, buffer)
    const base64 = buffer.toString('base64')
    return [
      { type: 'text' as const, text: `Screenshot saved: ${filepath}` },
      { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } },
    ]
  }

  // ── click ─────────────────────────────────────────────────────────────────────
  if (action === 'click') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('click requires selector')
    const page = await getPage()
    const locator = page.locator(selector).first()
    const delayMs = typeof input.delayMs === 'number' ? input.delayMs : 0
    if (delayMs > 0) {
      await locator.hover({ timeout: 8000 })
      await new Promise(r => setTimeout(r, Math.min(delayMs, 5000)))
    }
    if (input.doubleClick) {
      await locator.dblclick({ timeout: 8000, button: (input.button as any) ?? 'left' })
    } else {
      await locator.click({
        timeout: 8000,
        button: (input.button as any) ?? 'left',
        modifiers: (input.modifiers as any) ?? [],
      })
    }
    return `Clicked: ${selector}`
  }

  // ── fill ──────────────────────────────────────────────────────────────────────
  if (action === 'fill') {
    const selector = String(input.selector ?? '')
    const text = String(input.text ?? '')
    if (!selector) throw new Error('fill requires selector')
    const page = await getPage()
    await page.locator(selector).first().fill(text, { timeout: 8000 })
    return `Filled: ${selector}`
  }

  // ── type ──────────────────────────────────────────────────────────────────────
  if (action === 'type') {
    const selector = String(input.selector ?? '')
    const text = String(input.text ?? '')
    if (!selector) throw new Error('type requires selector')
    const page = await getPage()
    const locator = page.locator(selector).first()
    await locator.click({ timeout: 8000 })
    await locator.pressSequentially(text, { delay: input.slowly ? 80 : 0 })
    return `Typed into: ${selector}`
  }

  // ── pressKey ──────────────────────────────────────────────────────────────────
  if (action === 'pressKey') {
    const key = String(input.key ?? '')
    if (!key) throw new Error('pressKey requires key')
    const page = await getPage()
    const delayMs = typeof input.delayMs === 'number' ? Math.min(input.delayMs, 5000) : 0
    await page.keyboard.press(key, { delay: delayMs })
    return `Pressed key: ${key}`
  }

  // ── hover ─────────────────────────────────────────────────────────────────────
  if (action === 'hover') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('hover requires selector')
    const page = await getPage()
    await page.locator(selector).first().hover({ timeout: 8000 })
    return `Hovered: ${selector}`
  }

  // ── scroll ────────────────────────────────────────────────────────────────────
  if (action === 'scroll') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('scroll requires selector')
    const page = await getPage()
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 8000 })
    return `Scrolled into view: ${selector}`
  }

  // ── wait ──────────────────────────────────────────────────────────────────────
  if (action === 'wait') {
    const page = await getPage()
    const timeout = 20_000
    if (typeof input.timeMs === 'number') {
      await page.waitForTimeout(Math.min(input.timeMs, 30_000))
    }
    if (input.text) {
      await page.getByText(String(input.text)).first().waitFor({ state: 'visible', timeout })
    }
    if (input.textGone) {
      await page.getByText(String(input.textGone)).first().waitFor({ state: 'hidden', timeout })
    }
    if (input.selector) {
      await page.locator(String(input.selector)).first().waitFor({ state: 'visible', timeout })
    }
    if (input.url) {
      await page.waitForURL(String(input.url), { timeout })
    }
    if (input.loadState) {
      await page.waitForLoadState(input.loadState as any, { timeout })
    }
    return 'Wait condition satisfied.'
  }

  // ── evaluate ──────────────────────────────────────────────────────────────────
  if (action === 'evaluate') {
    const fn = String(input.fn ?? '').trim()
    if (!fn) throw new Error('evaluate requires fn')
    const page = await getPage()
    const outerTimeout = 20_000
    const evalTimeout = outerTimeout - 500
    // 注入 Promise.race 超时，防止 async 函数永久阻塞 playwright 命令队列
    const result = await page.evaluate(
      ({ fnBody, timeoutMs }) => {
        try {
          // eslint-disable-next-line no-eval
          const candidate = eval(`(${fnBody})`)
          const ret = typeof candidate === 'function' ? candidate() : candidate
          if (ret && typeof ret.then === 'function') {
            return Promise.race([
              ret,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`evaluate timed out after ${timeoutMs}ms`)), timeoutMs),
              ),
            ])
          }
          return ret
        } catch (err: any) {
          throw new Error(`Invalid evaluate function: ${err?.message ?? String(err)}`)
        }
      },
      { fnBody: fn, timeoutMs: evalTimeout },
    )
    return JSON.stringify(result, null, 2).slice(0, 5000)
  }

  throw new Error(`Unknown action: ${action}`)
}

export const BrowserTool = buildTool({
  name: 'browser',
  description: BROWSER_DESCRIPTION,
  searchHint: BROWSER_SEARCH_HINT,
  deferLoading: true,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'navigate', 'snapshot', 'screenshot', 'click', 'fill', 'type',
               'pressKey', 'hover', 'scroll', 'wait', 'evaluate', 'getText', 'getHTML', 'search', 'close'],
        description: 'The browser action to perform',
      },
      url: { type: 'string', description: 'URL for navigate/connect/search actions' },
      selector: { type: 'string', description: 'CSS selector for element actions' },
      text: { type: 'string', description: 'Text for fill/type/search/wait actions' },
      key: { type: 'string', description: 'Key name for pressKey (e.g. Enter, Tab, Escape)' },
      fn: { type: 'string', description: 'JavaScript function body for evaluate' },
      fullPage: { type: 'boolean', description: 'Full page screenshot (default: false)' },
      path: { type: 'string', description: 'Custom save path for screenshot' },
      doubleClick: { type: 'boolean', description: 'Double click instead of single click' },
      button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button' },
      modifiers: {
        type: 'array',
        items: { type: 'string', enum: ['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'] },
        description: 'Modifier keys for click',
      },
      delayMs: { type: 'number', description: 'Delay in ms before click or between key presses' },
      slowly: { type: 'boolean', description: 'Type slowly (80ms per char) for type action' },
      textGone: { type: 'string', description: 'Wait for text to disappear' },
      loadState: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: 'Page load state to wait for',
      },
      timeMs: { type: 'number', description: 'Fixed wait time in ms' },
    },
    required: ['action'],
  },
  isReadOnly: () => false,
  async callWithBlocks(input) {
    return handleAction(input as Record<string, unknown>)
  },
  async call(input) {
    const result = await handleAction(input as Record<string, unknown>)
    if (Array.isArray(result)) {
      return result.filter(b => b.type === 'text').map(b => (b as any).text).join('\n')
    }
    return result
  },
  renderToolUse(input) {
    return <BrowserToolUseUI input={input as any} />
  },
  renderToolResult(result) {
    return <BrowserToolResultUI result={result} />
  },
})
```

- [ ] **Step 2: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/tools/BrowserTool/BrowserTool.tsx
git commit -m "feat(BrowserTool): implement all 15 browser actions"
```

---

### Task 12: 注册 BrowserTool

**Files:**
- Modify: `src/tools/index.ts`

- [ ] **Step 1: 添加 import**

在 `src/tools/index.ts` 现有 import 列表末尾追加：

```ts
import { BrowserTool } from './BrowserTool/BrowserTool.js'
```

- [ ] **Step 2: 加入 BUILTIN_TOOLS**

在 `BUILTIN_TOOLS` 数组末尾追加 `BrowserTool`：

```ts
const BUILTIN_TOOLS: Tool[] = [
  // ...existing tools...
  BrowserTool,
]
```

- [ ] **Step 3: 确认编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 4: 运行全量测试**

```bash
npx vitest run
```

Expected: 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat(tools): register BrowserTool"
```

---

## Self-Review

**Spec coverage check:**

| Spec 要求 | 计划任务 |
|-----------|---------|
| ToolResultContent 支持 image block | Task 1 |
| callWithBlocks 可选方法 | Task 3 |
| modelSupportsVision | Task 2 |
| query.ts 优先 callWithBlocks + vision 降级 | Task 5 |
| toolResultStorage array content 透传 | Task 4 |
| browser.ts CDP + 自启动双模式 | Task 7 |
| 截图压缩（2000px, 5MB） | Task 8 |
| connect/navigate/snapshot/screenshot/click/fill/type/pressKey/hover/scroll/wait/evaluate/getText/getHTML/search/close | Task 11 |
| 反检测脚本（自启动模式） | Task 7 |
| deferLoading: true | Task 11 |
| 注册到 BUILTIN_TOOLS | Task 12 |

所有 spec 要求均有对应任务，无遗漏。
