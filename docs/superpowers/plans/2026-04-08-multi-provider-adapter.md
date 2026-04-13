# Multi-Provider Adapter 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 pi 进程内实现 OpenAI 兼容适配层，让 Anthropic SDK 能透明对接 DeepSeek 等 OpenAI 兼容提供商。

**Architecture:** 通过 Anthropic SDK 的 `fetch` 选项注入自定义拦截器，在进程内将 Anthropic Messages API 格式转换为 OpenAI Chat Completions 格式（含流式 SSE），响应再转回 Anthropic 格式。`query.ts` 等上层代码零感知，只需配置环境变量。

**Tech Stack:** TypeScript, `@anthropic-ai/sdk` ^0.40.0, vitest ^4.1.2, Node.js fetch API

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/providers/types.ts` | 新建 | `ProviderAdapter` 接口定义 |
| `src/providers/openai.ts` | 新建 | OpenAI 兼容 adapter（请求/响应转换） |
| `src/providers/index.ts` | 新建 | 根据 `PI_PROVIDER` 返回 adapter |
| `src/anthropic.ts` | 修改 | 注入 adapter fetch |
| `src/providers/__tests__/openai.test.ts` | 新建 | OpenAIAdapter 单元测试 |
| `.env.example` | 修改 | 新增 `PI_PROVIDER` 说明 |

---

### Task 1: 定义 ProviderAdapter 接口

**Files:**
- Create: `src/providers/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// src/providers/types.ts

export interface ProviderAdapter {
  fetch(url: string | URL, init?: RequestInit): Promise<Response>
}
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/providers/types.ts
git commit -m "feat(providers): add ProviderAdapter interface"
```

---

### Task 2: 实现请求转换（Anthropic → OpenAI，非流式）

**Files:**
- Create: `src/providers/__tests__/openai.test.ts`
- Create: `src/providers/openai.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/providers/__tests__/openai.test.ts
import { describe, it, expect, vi } from 'vitest'
import { OpenAIAdapter } from '../openai.js'

describe('OpenAIAdapter - 请求转换', () => {
  it('将 Anthropic 请求体转换为 OpenAI 格式', async () => {
    let capturedBody: unknown
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    })

    const adapter = new OpenAIAdapter({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      fetchImpl: mockFetch,
    })

    const anthropicBody = {
      model: 'deepseek-chat',
      system: 'You are helpful.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      max_tokens: 100,
    }

    await adapter.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(anthropicBody),
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(capturedBody).toMatchObject({
      model: 'deepseek-chat',
      max_tokens: 100,
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx vitest run src/providers/__tests__/openai.test.ts
```

Expected: FAIL — `Cannot find module '../openai.js'`

- [ ] **Step 3: 实现 OpenAIAdapter（请求转换部分）**

```typescript
// src/providers/openai.ts
import type { ProviderAdapter } from './types.js'

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

type AnthropicTool = {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

type AnthropicRequestBody = {
  model: string
  system?: string
  messages: AnthropicMessage[]
  tools?: AnthropicTool[]
  max_tokens?: number
  stream?: boolean
  temperature?: number
  top_p?: number
}

type OpenAIMessage = {
  role: string
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

export type OpenAIAdapterOptions = {
  baseURL: string
  apiKey: string
  fetchImpl?: typeof fetch
}

export class OpenAIAdapter implements ProviderAdapter {
  private baseURL: string
  private apiKey: string
  private fetchImpl: typeof fetch

  constructor(options: OpenAIAdapterOptions) {
    this.baseURL = options.baseURL.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    const body = JSON.parse(init?.body as string) as AnthropicRequestBody
    const isStream = body.stream === true

    const openaiMessages = this.convertMessages(body)
    const openaiBody: Record<string, unknown> = {
      model: body.model,
      messages: openaiMessages,
      stream: isStream,
    }
    if (body.max_tokens !== undefined) openaiBody.max_tokens = body.max_tokens
    if (body.temperature !== undefined) openaiBody.temperature = body.temperature
    if (body.top_p !== undefined) openaiBody.top_p = body.top_p
    if (body.tools?.length) {
      openaiBody.tools = body.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description ?? '',
          parameters: t.input_schema,
        },
      }))
      openaiBody.tool_choice = 'auto'
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'authorization': `Bearer ${this.apiKey}`,
    }

    const response = await this.fetchImpl(
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(openaiBody),
      },
    )

    if (!response.ok && !isStream) {
      return response
    }

    if (isStream) {
      return this.convertStreamResponse(response, body.model)
    }
    return this.convertNonStreamResponse(response, body.model)
  }

  private convertMessages(body: AnthropicRequestBody): OpenAIMessage[] {
    const messages: OpenAIMessage[] = []

    if (body.system) {
      messages.push({ role: 'system', content: body.system })
    }

    for (const msg of body.messages) {
      if (typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: msg.content })
        continue
      }

      const textBlocks = msg.content.filter(b => b.type === 'text') as Array<{ type: 'text'; text: string }>
      const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use') as Array<{ type: 'tool_use'; id: string; name: string; input: unknown }>
      const toolResultBlocks = msg.content.filter(b => b.type === 'tool_result') as Array<{ type: 'tool_result'; tool_use_id: string; content: unknown }>

      if (toolResultBlocks.length > 0) {
        for (const tr of toolResultBlocks) {
          const content = typeof tr.content === 'string'
            ? tr.content
            : Array.isArray(tr.content)
              ? (tr.content as Array<{ type: string; text?: string }>)
                  .filter(b => b.type === 'text')
                  .map(b => b.text ?? '')
                  .join('')
              : String(tr.content)
          messages.push({ role: 'tool', content, tool_call_id: tr.tool_use_id } as OpenAIMessage)
        }
        continue
      }

      if (toolUseBlocks.length > 0) {
        messages.push({
          role: 'assistant',
          content: textBlocks.map(b => b.text).join('') || null,
          tool_calls: toolUseBlocks.map(b => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          })),
        })
        continue
      }

      messages.push({
        role: msg.role,
        content: textBlocks.map(b => b.text).join(''),
      })
    }

    return messages
  }

  private async convertNonStreamResponse(response: Response, model: string): Promise<Response> {
    const data = await response.json() as {
      id: string
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
        finish_reason: string
      }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const choice = data.choices[0]
    const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'

    const content: unknown[] = []
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content })
    }
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        })
      }
    }

    const anthropicResponse = {
      id: data.id,
      type: 'message',
      role: 'assistant',
      model,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: data.usage
        ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
        : { input_tokens: 0, output_tokens: 0 },
    }

    return new Response(JSON.stringify(anthropicResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  private convertStreamResponse(response: Response, model: string): Response {
    const messageId = `msg_${Date.now()}`
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        send('message_start', {
          type: 'message_start',
          message: { id: messageId, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } },
        })
        send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        send('ping', { type: 'ping' })

        // tool_calls 累积状态
        const toolCallAccum: Record<number, { id: string; name: string; arguments: string }> = {}
        let hasToolCalls = false
        let finishReason = 'stop'

        const reader = response.body!.getReader()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') continue

            let chunk: {
              choices: Array<{
                delta: {
                  content?: string | null
                  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>
                }
                finish_reason?: string | null
              }>
            }
            try { chunk = JSON.parse(raw) } catch { continue }

            const delta = chunk.choices[0]?.delta
            if (!delta) continue

            if (chunk.choices[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason
            }

            if (delta.content) {
              send('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: delta.content },
              })
            }

            if (delta.tool_calls) {
              hasToolCalls = true
              for (const tc of delta.tool_calls) {
                if (!toolCallAccum[tc.index]) {
                  toolCallAccum[tc.index] = { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' }
                }
                if (tc.function?.arguments) {
                  toolCallAccum[tc.index].arguments += tc.function.arguments
                }
                if (tc.id) toolCallAccum[tc.index].id = tc.id
                if (tc.function?.name) toolCallAccum[tc.index].name = tc.function.name
              }
            }
          }
        }

        send('content_block_stop', { type: 'content_block_stop', index: 0 })

        // 输出工具调用 blocks
        if (hasToolCalls) {
          let blockIndex = 1
          for (const [, tc] of Object.entries(toolCallAccum)) {
            send('content_block_start', {
              type: 'content_block_start',
              index: blockIndex,
              content_block: { type: 'tool_use', id: tc.id, name: tc.name, input: {} },
            })
            send('content_block_delta', {
              type: 'content_block_delta',
              index: blockIndex,
              delta: { type: 'input_json_delta', partial_json: tc.arguments },
            })
            send('content_block_stop', { type: 'content_block_stop', index: blockIndex })
            blockIndex++
          }
        }

        const stopReason = finishReason === 'tool_calls' ? 'tool_use' : 'end_turn'
        send('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: 0 },
        })
        send('message_stop', { type: 'message_stop' })

        controller.close()
      },
    })

    return new Response(readable, {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
    })
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx vitest run src/providers/__tests__/openai.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/openai.ts src/providers/__tests__/openai.test.ts
git commit -m "feat(providers): implement OpenAIAdapter with request conversion"
```

---

### Task 3: 补充非流式响应转换测试

**Files:**
- Modify: `src/providers/__tests__/openai.test.ts`

- [ ] **Step 1: 追加非流式响应测试**

在 `openai.test.ts` 末尾追加：

```typescript
describe('OpenAIAdapter - 非流式响应转换', () => {
  it('将 OpenAI 响应转换为 Anthropic 格式', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-abc',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    )

    const adapter = new OpenAIAdapter({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      fetchImpl: mockFetch,
    })

    const response = await adapter.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        max_tokens: 50,
      }),
    })

    const body = await response.json() as {
      type: string
      role: string
      content: Array<{ type: string; text: string }>
      stop_reason: string
      usage: { input_tokens: number; output_tokens: number }
    }
    expect(body.type).toBe('message')
    expect(body.role).toBe('assistant')
    expect(body.content).toEqual([{ type: 'text', text: 'Hi there!' }])
    expect(body.stop_reason).toBe('end_turn')
    expect(body.usage).toEqual({ input_tokens: 8, output_tokens: 3 })
  })

  it('将工具调用响应转换为 Anthropic tool_use 格式', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-tool',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_abc',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"city":"Beijing"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    )

    const adapter = new OpenAIAdapter({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      fetchImpl: mockFetch,
    })

    const response = await adapter.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Weather?' }] }],
        tools: [{ name: 'get_weather', description: 'Get weather', input_schema: { type: 'object', properties: { city: { type: 'string' } } } }],
        max_tokens: 100,
      }),
    })

    const body = await response.json() as {
      stop_reason: string
      content: Array<{ type: string; id?: string; name?: string; input?: unknown }>
    }
    expect(body.stop_reason).toBe('tool_use')
    expect(body.content).toContainEqual({
      type: 'tool_use',
      id: 'call_abc',
      name: 'get_weather',
      input: { city: 'Beijing' },
    })
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx vitest run src/providers/__tests__/openai.test.ts
```

Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add src/providers/__tests__/openai.test.ts
git commit -m "test(providers): add non-stream response conversion tests"
```

---

### Task 4: 实现 providers/index.ts 和修改 anthropic.ts

**Files:**
- Create: `src/providers/index.ts`
- Modify: `src/anthropic.ts`

- [ ] **Step 1: 创建 providers/index.ts**

```typescript
// src/providers/index.ts
import type { ProviderAdapter } from './types.js'
import { OpenAIAdapter } from './openai.js'

export function resolveAdapter(): ProviderAdapter | null {
  const provider = process.env.PI_PROVIDER?.toLowerCase()
  if (!provider || provider === 'anthropic') return null

  const baseURL = process.env.PI_BASE_URL
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''

  if (provider === 'openai' || provider === 'deepseek' || provider === 'openrouter') {
    if (!baseURL) {
      throw new Error(`PI_PROVIDER=${provider} 需要设置 PI_BASE_URL`)
    }
    return new OpenAIAdapter({ baseURL, apiKey })
  }

  throw new Error(`未知的 PI_PROVIDER: ${provider}。支持的值: anthropic, openai, deepseek, openrouter`)
}
```

- [ ] **Step 2: 修改 src/anthropic.ts**

将文件内容替换为：

```typescript
// Anthropic 客户端工厂 — 统一读取环境变量，避免散落在各模块
import Anthropic from '@anthropic-ai/sdk'
import { resolveAdapter } from './providers/index.js'

export function createAnthropicClient(): Anthropic {
  const adapter = resolveAdapter()
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: adapter ? undefined : process.env.PI_BASE_URL,
    fetch: adapter ? adapter.fetch.bind(adapter) : undefined,
  })
}
```

注意：使用 adapter 时 `baseURL` 设为 `undefined`，因为 adapter 内部直接用 `PI_BASE_URL` 构造目标 URL，不需要 SDK 再拼接。

- [ ] **Step 3: 类型检查**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/providers/index.ts src/anthropic.ts
git commit -m "feat(providers): wire adapter into createAnthropicClient"
```

---

### Task 5: 更新 .env.example 和手动验证

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 更新 .env.example**

将 `.env.example` 内容替换为：

```
# Pi 配置文件
# 复制此文件为 .env 并填入你的值

# API Key（必填）
ANTHROPIC_API_KEY=your_api_key_here

# LLM 提供商（可选，默认 anthropic）
# 支持: anthropic | deepseek | openai | openrouter
PI_PROVIDER=anthropic

# API Base URL
# anthropic: 留空（使用官方 API）
# deepseek:  https://api.deepseek.com/v1
# openrouter: https://openrouter.ai/api/v1
# 自定义 OpenAI 兼容: 填入对应地址
PI_BASE_URL=

# 模型名称（可选）
# anthropic: claude-sonnet-4-6
# deepseek:  deepseek-chat / deepseek-reasoner
PI_MODEL=claude-sonnet-4-6
```

- [ ] **Step 2: 运行全部测试**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx vitest run
```

Expected: 全部 PASS，无新增失败

- [ ] **Step 3: 用 DeepSeek 手动验证（需要有效 key）**

将 `.env` 改为：
```
ANTHROPIC_API_KEY=<你的 DeepSeek key>
PI_PROVIDER=deepseek
PI_BASE_URL=https://api.deepseek.com/v1
PI_MODEL=deepseek-chat
```

然后运行：
```bash
cd /Users/mac/Documents/ai/pi-claude-code
npm run dev
```

发送一条消息，确认能正常收到回复。

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with PI_PROVIDER config"
```

---

## 自检

- [x] **Spec 覆盖**：OpenAIAdapter（请求+响应+工具调用+流式）✓，providers/index.ts ✓，anthropic.ts 修改 ✓，.env.example ✓
- [x] **无占位符**：所有步骤含完整代码
- [x] **类型一致**：`OpenAIAdapter` 在 Task 2 定义，Task 4 直接 import；`resolveAdapter` 在 Task 4 定义，`anthropic.ts` 直接 import
- [x] **流式响应**：Task 2 Step 3 的 `convertStreamResponse` 已实现完整 SSE 转换逻辑
