# Multi-Provider Adapter 设计文档

**日期**: 2026-04-08  
**状态**: 待实现

---

## 目标

让 pi 能对接任意格式的 LLM 提供商，不只是 Anthropic。Anthropic SDK 保留为原生路径，其他提供商通过内嵌适配层在进程内完成格式转换，`query.ts` 等上层代码零感知。

---

## 架构

```
createAnthropicClient()
  ├── PI_PROVIDER=anthropic (默认) → 原生 Anthropic SDK，无拦截
  ├── PI_PROVIDER=openai           → OpenAIAdapter（通用 OpenAI 兼容）
  ├── PI_PROVIDER=deepseek         → OpenAIAdapter（复用，DeepSeek 是 OpenAI 兼容）
  └── PI_PROVIDER=gemini           → GeminiAdapter（Anthropic → Gemini 原生格式）
```

适配层通过 Anthropic SDK 的 `fetch` 选项注入，拦截所有出站请求，在进程内完成格式转换后直接 fetch 目标提供商。

---

## 文件结构

```
src/
├── anthropic.ts                  # 修改：注入 adapter fetch
└── providers/
    ├── types.ts                  # ProviderAdapter 接口
    ├── index.ts                  # 根据 PI_PROVIDER 返回 adapter
    ├── openai.ts                 # OpenAI 兼容 adapter（DeepSeek/OpenRouter 复用）
    └── gemini.ts                 # Google Gemini 原生 adapter（后续实现）
```

---

## 组件设计

### `src/providers/types.ts`

```ts
export interface ProviderAdapter {
  fetch(url: string | URL, init?: RequestInit): Promise<Response>
}
```

### `src/providers/index.ts`

根据 `PI_PROVIDER` 环境变量返回对应 adapter，未设置或为 `anthropic` 时返回 `null`（走原生路径）。

### `src/providers/openai.ts`

`OpenAIAdapter` 实现 `ProviderAdapter`，在 `fetch` 方法内：
1. 解析 Anthropic 请求体
2. 转换为 OpenAI 格式
3. 用原生 `fetch` 打 `PI_BASE_URL/chat/completions`
4. 将响应（流式或非流式）转换回 Anthropic 格式返回

### `src/anthropic.ts`（修改）

```ts
export function createAnthropicClient(): Anthropic {
  const adapter = resolveAdapter()
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.PI_BASE_URL,
    fetch: adapter ? adapter.fetch.bind(adapter) : undefined,
  })
}
```

---

## 数据流：OpenAI Adapter

### 请求转换（Anthropic → OpenAI）

| Anthropic 字段 | OpenAI 字段 |
|---|---|
| `model` | `model` |
| `system` (string) | `messages[0]` `{role:"system", content}` |
| `messages[].role` | `messages[].role`（user/assistant 不变） |
| `messages[].content` (array of blocks) | `messages[].content`（合并 text blocks 为字符串） |
| `tools[].input_schema` | `tools[].function.parameters` |
| `tools[].name/description` | `tools[].function.name/description` |
| `max_tokens` | `max_tokens` |
| `stream` | `stream` |

### 响应转换（OpenAI SSE → Anthropic SSE，流式）

| OpenAI SSE | Anthropic SSE |
|---|---|
| `choices[0].delta.content` | `content_block_delta` (text) |
| `choices[0].delta.tool_calls` | `content_block_delta` (input_json_delta) |
| `[DONE]` | `message_stop` |
| `finish_reason: "stop"` | `stop_reason: "end_turn"` |
| `finish_reason: "tool_calls"` | `stop_reason: "tool_use"` |

### 工具调用转换

**请求（Anthropic → OpenAI）**：
```
{type:"tool_use", id, name, input}
→ {id, type:"function", function:{name, arguments: JSON.stringify(input)}}
```

**响应（OpenAI → Anthropic）**：
流式 `tool_calls` delta 需累积 `arguments` 字符串，完整后解析为 JSON，再组装成 Anthropic `tool_use` block。

---

## 环境变量

```
PI_PROVIDER=deepseek              # 选择 adapter（不设置 = anthropic 原生）
PI_BASE_URL=https://api.deepseek.com/v1  # 转发目标（不含路径后缀）
PI_MODEL=deepseek-chat            # 模型名
ANTHROPIC_API_KEY=sk-xxx          # 复用为目标提供商的 API key
```

---

## 错误处理

- 目标提供商返回非 2xx：透传 HTTP 状态码和错误体，Anthropic SDK 的错误处理逻辑正常触发
- 格式转换失败：抛出明确错误，包含原始请求/响应片段，便于调试

---

## 范围

**本次实现**：
- `OpenAIAdapter`（覆盖 DeepSeek、OpenRouter 等 OpenAI 兼容提供商）
- 流式和非流式响应
- 工具调用（tool use）

**不在本次范围**：
- `GeminiAdapter`（结构预留，后续实现）
- 多 API key 管理
- 请求重试（复用 Anthropic SDK 现有重试逻辑）
