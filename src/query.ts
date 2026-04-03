// 核心主循环 — 对标 Claude Code src/query.ts
// 纯 async generator，与 React 无关
// 职责：调 Claude API → 流式接收 → 执行工具 → yield StreamEvent

import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from './Tool.js'
import type { Message, StreamEvent, UserMessage, AssistantMessage } from './types/message.js'
import { createToolResultMessage } from './utils/messages.js'
import { findTool } from './tools/index.js'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.PI_BASE_URL,
})

/** 将 Pi 的 Tool 格式转换为 Anthropic SDK 格式 */
function toSDKTool(tool: Tool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
  }
}

/** 将 Pi 的 Message[] 转换为 Anthropic SDK 格式 */
function toSDKMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((msg) => ({
    role: msg.type as 'user' | 'assistant',
    content: msg.content as Anthropic.MessageParam['content'],
  }))
}

export type QueryParams = {
  messages: Message[]
  tools: Tool[]
  systemPrompt: string
  model?: string
}

/**
 * 核心主循环：调用 Claude API，流式 yield 事件
 *
 * 使用方式（在 REPL.tsx 中）：
 *   for await (const event of query(params)) {
 *     if (event.type === 'text_delta') { ... }
 *     if (event.type === 'tool_use') { ... }
 *     if (event.type === 'done') break
 *   }
 */
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  const { messages, tools, systemPrompt, model = process.env.PI_MODEL ?? 'deepseek-chat' } = params

  let currentMessages = [...messages]

  // 循环：支持多轮工具调用（tool_use → tool_result → 继续对话）
  while (true) {
    const assistantContent: AssistantMessage['content'] = []
    let hasToolUse = false

    try {
      // 流式调用 Claude API
      const stream = await client.messages.stream({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: toSDKMessages(currentMessages),
        tools: tools.map(toSDKTool),
      })

      // 处理流式事件
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            const delta = chunk.delta.text
            // 追加到当前 assistant 消息的文本内容
            const lastContent = assistantContent[assistantContent.length - 1]
            if (lastContent && lastContent.type === 'text') {
              lastContent.text += delta
            } else {
              assistantContent.push({ type: 'text', text: delta })
            }
            yield { type: 'text_delta', delta }
          } else if (chunk.delta.type === 'input_json_delta') {
            // 累积 tool input JSON（流式传输）
            const lastContent = assistantContent[assistantContent.length - 1]
            if (lastContent && lastContent.type === 'tool_use') {
              // 将增量 JSON 字符串累积到临时字段
              const existing = (lastContent as any)._inputJson ?? ''
              ;(lastContent as any)._inputJson = existing + chunk.delta.partial_json
            }
          }
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            assistantContent.push({
              type: 'tool_use',
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              input: {},
            })
            hasToolUse = true
          }
        } else if (chunk.type === 'message_stop') {
          // 解析所有 tool_use 的完整 input
          for (const c of assistantContent) {
            if (c.type === 'tool_use') {
              const raw = (c as any)._inputJson ?? '{}'
              try {
                c.input = JSON.parse(raw)
              } catch {
                c.input = {}
              }
              delete (c as any)._inputJson
            }
          }
        }
      }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }

    // 将 assistant 消息追加到历史
    const assistantMsg: AssistantMessage = { type: 'assistant', content: assistantContent }
    currentMessages.push(assistantMsg)

    // 如果没有工具调用，对话结束
    if (!hasToolUse) {
      yield { type: 'done' }
      return
    }

    // 执行所有工具调用
    const toolResults: UserMessage['content'] = []
    for (const c of assistantContent) {
      if (c.type === 'tool_use') {
        yield { type: 'tool_use', id: c.id, name: c.name, input: c.input }

        const tool = findTool(c.name, tools)
        let result: string
        if (!tool) {
          result = `Error: tool "${c.name}" not found`
        } else {
          try {
            result = await tool.call(c.input)
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        }

        toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: result })
        yield { type: 'tool_result', tool_use_id: c.id, content: result }
      }
    }

    // 将 tool_result 追加到历史，继续下一轮
    currentMessages.push({ type: 'user', content: toolResults })
  }
}
