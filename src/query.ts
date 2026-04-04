// 核心主循环 — 对标 Claude Code src/query.ts + QueryEngine.ts
// 纯 async generator，与 React 无关
// 职责：调 API → 流式接收 → 权限检查 → 执行工具 → yield StreamEvent

import Anthropic from '@anthropic-ai/sdk'
import type { Tool, ToolUseContext } from './Tool.js'
import type { Message, StreamEvent, UserMessage, AssistantMessage } from './types/message.js'
import { getAppState, setAppState } from './state/AppState.js'
import { buildTodoReminderIfNeeded } from './state/todoReminder.js'
import { findTool } from './tools/index.js'
import { initTaskStore } from './tasks/taskFileStore.js'
import { autoCompactIfNeeded } from './compact/autoCompact.js'
import { executeHooks } from './hooks/index.js'

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** 工具权限检查函数（对标 Claude Code canUseTool）*/
export type CanUseTool = (
  name: string,
  input: unknown,
) => Promise<'allow' | 'deny'>

export type QueryParams = {
  messages: Message[]
  /** 激活工具（传给 API，isEnabled() && !deferLoading） */
  tools: Tool[]
  /** 全部工具（传给 ToolUseContext，供 ToolSearchTool 访问） */
  allTools?: Tool[]
  systemPrompt: string
  model?: string
  /** 最大工具调用轮数（对标 Claude Code maxTurns）*/
  maxTurns?: number
  /** 中止信号（对标 Claude Code abortController）*/
  abortSignal?: AbortSignal
  /** 工具权限检查（未提供时默认全部允许）*/
  canUseTool?: CanUseTool
  /** 将问题转交给 REPL，等待用户选择 */
  askUser?: ToolUseContext['askUser']
  enterPlanMode?: ToolUseContext['enterPlanMode']
  exitPlanMode?: ToolUseContext['exitPlanMode']
  verifyExecution?: ToolUseContext['verifyExecution']
  onExit?: ToolUseContext['onExit']
  sessionId?: string
}

// ── 内部辅助 ──────────────────────────────────────────────────────────────────

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
  return messages
    .filter((msg): msg is Exclude<Message, { type: 'compact_boundary' }> => msg.type !== 'compact_boundary')
    .map((msg) => ({
      role: msg.type as 'user' | 'assistant',
      content: msg.content as Anthropic.MessageParam['content'],
    }))
}

// ── 单轮流式调用（对标 Claude Code claude.ts 中的 API 流）─────────────────────

/**
 * 对 API 发起一轮流式请求，累积 assistantContent 并 yield 文本 delta。
 * 不做工具执行 — 那是 executeTools 的事。
 */
async function* streamOneTurn(
  client: Anthropic,
  params: {
    model: string
    systemPrompt: string
    messages: Message[]
    tools: Tool[]
    abortSignal?: AbortSignal
  },
): AsyncGenerator<StreamEvent, AssistantMessage['content']> {
  const assistantContent: AssistantMessage['content'] = []

  const stream = client.messages.stream(
    {
      model: params.model,
      max_tokens: 8192,
      system: params.systemPrompt,
      messages: toSDKMessages(params.messages),
      tools: params.tools.map(toSDKTool),
    },
    { signal: params.abortSignal },
  )

  for await (const chunk of stream) {
    // 中止检查
    if (params.abortSignal?.aborted) {
      return assistantContent
    }

    if (chunk.type === 'content_block_start') {
      if (chunk.content_block.type === 'tool_use') {
        // tool_use 的 input 会在后续 delta 中陆续到达，这里先占一个壳。
        assistantContent.push({
          type: 'tool_use',
          id: chunk.content_block.id,
          name: chunk.content_block.name,
          input: {},
        })
      }
    } else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta') {
        const delta = chunk.delta.text
        const last = assistantContent[assistantContent.length - 1]
        if (last?.type === 'text') {
          last.text += delta
        } else {
          assistantContent.push({ type: 'text', text: delta })
        }
        yield { type: 'text_delta', delta }
      } else if (chunk.delta.type === 'input_json_delta') {
        // 累积 tool input JSON（流式传输）
        const last = assistantContent[assistantContent.length - 1]
        if (last?.type === 'tool_use') {
          const existing = (last as any)._inputJson ?? ''
          ;(last as any)._inputJson = existing + chunk.delta.partial_json
        }
      }
    } else if (chunk.type === 'message_stop') {
      // 解析所有 tool_use 的完整 input
      for (const c of assistantContent) {
        if (c.type === 'tool_use') {
          const raw = (c as any)._inputJson ?? '{}'
          try {
            // SDK 把工具参数按 JSON 碎片流出来，结束时再一次性还原成对象。
            c.input = JSON.parse(raw)
          } catch {
            // 解析失败时回退为空对象，避免整个 query 循环因为坏 JSON 中断。
            c.input = {}
          }
          delete (c as any)._inputJson
        }
      }
    }
  }

  return assistantContent
}

// ── 工具执行（对标 Claude Code runTools）─────────────────────────────────────

/**
 * 执行单轮的所有工具调用，yield tool_use / tool_result / tool_denied 事件。
 * 返回 toolResults 列表用于追加到历史。
 */
async function* executeTools(
  toolUses: AssistantMessage['content'],
  tools: Tool[],
  canUseTool: CanUseTool,
  context: ToolUseContext,
  sessionId: string,
): AsyncGenerator<StreamEvent, UserMessage['content']> {
  const toolResults: UserMessage['content'] = []

  for (const c of toolUses) {
    if (c.type !== 'tool_use') continue

    // Fire PreToolUse hook — may override permission
    const preToolHookResult = await executeHooks(
      {
        hook_event_name: 'PreToolUse',
        tool_name: c.name,
        tool_input: c.input,
        session_id: sessionId,
        cwd: context.cwd,
      },
      { matcherQuery: c.name, signal: context.abortSignal },
    )

    let permission: 'allow' | 'deny'
    if (preToolHookResult.permissionDecision === 'deny') {
      permission = 'deny'
    } else if (preToolHookResult.preventContinuation) {
      return toolResults
    } else {
      // 权限检查（对标 Claude Code canUseTool）
      permission = await canUseTool(c.name, c.input)
    }

    if (permission === 'deny') {
      yield { type: 'tool_denied', tool_use_id: c.id, name: c.name }
      await executeHooks(
        {
          hook_event_name: 'PermissionDenied',
          tool_name: c.name,
          tool_input: c.input,
          session_id: sessionId,
          cwd: context.cwd,
        },
        { matcherQuery: c.name, signal: context.abortSignal },
      )
      toolResults.push({
        type: 'tool_result',
        tool_use_id: c.id,
        // 仍然补一条 tool_result，保证模型下一轮能看到“工具未执行”的结果。
        content: 'Tool use was denied by the user.',
      })
      if (preToolHookResult.preventContinuation) {
        return toolResults
      }
      continue
    }

    // 先把 tool_use 事件抛给上层 UI，再真正执行工具，便于界面即时展示。
    yield { type: 'tool_use', id: c.id, name: c.name, input: c.input }

    const tool = findTool(c.name, tools)
    let result: string
    if (!tool) {
      result = `Error: tool "${c.name}" not found`
    } else {
      try {
        result = await tool.call(c.input, context)
        await executeHooks(
          {
            hook_event_name: 'PostToolUse',
            tool_name: c.name,
            tool_input: c.input,
            tool_response: result,
            session_id: sessionId,
            cwd: context.cwd,
          },
          { matcherQuery: c.name, signal: context.abortSignal },
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        result = `Error: ${errMsg}`
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

    toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: result })
    yield { type: 'tool_result', tool_use_id: c.id, content: result }
  }

  return toolResults
}

// ── 默认 canUseTool（空方法占位，后续由 REPL 注入实际实现）────────────────────

/** 默认全部允许（REPL 会传入实际的 canUseTool 弹窗逻辑） */
async function defaultCanUseTool(_name: string, _input: unknown): Promise<'allow' | 'deny'> {
  return 'allow'
}

// ── 主循环（对标 Claude Code queryLoop）──────────────────────────────────────

/**
 * 核心主循环：调用 API，流式 yield 事件，支持多轮工具调用
 *
 * 使用方式（在 REPL.tsx 中）：
 *   for await (const event of query(params)) {
 *     if (event.type === 'text_delta') { ... }
 *     if (event.type === 'tool_use') { ... }
 *     if (event.type === 'done') break
 *   }
 */
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  const {
    messages,
    tools,
    allTools,
    systemPrompt,
    model = process.env.PI_MODEL ?? 'deepseek-chat',
    maxTurns = 10,
    abortSignal,
    canUseTool = defaultCanUseTool,
    askUser,
    enterPlanMode,
    exitPlanMode,
    verifyExecution,
    onExit,
    sessionId: paramsSessionId,
  } = params

  const sessionId = paramsSessionId ?? ''

  await initTaskStore()

  // ToolUseContext 在整个 query 生命周期内复用
  const toolUseContext: ToolUseContext = {
    abortSignal: abortSignal ?? new AbortController().signal,
    cwd: process.cwd(),
    tools: allTools ?? tools, // ToolSearchTool 能看到所有工具，包括 deferLoading 的
    getAppState,
    setAppState,
    askUser,
    enterPlanMode,
    exitPlanMode,
    verifyExecution,
    onExit,
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.PI_BASE_URL,
  })

  // currentMessages 会在每一轮后持续扩展，形成“assistant -> tool_result -> assistant”的链路。
  let currentMessages = [...messages]
  let turnCount = 0

  // ── 主循环 ────────────────────────────────────────────────────────────────
  while (true) {
    // ── Auto compact check ──────────────────────────────────────────────
    const compactResult = await autoCompactIfNeeded(currentMessages)
    if (compactResult.wasCompacted && compactResult.result) {
      currentMessages = compactResult.result.newMessages
      yield { type: 'compact_start' }
      yield {
        type: 'compact_done',
        savedTokens: compactResult.result.savedTokens,
        summaryLength: compactResult.result.summaryLength,
        newMessages: compactResult.result.newMessages,
      }
    }

    // 中止检查
    if (abortSignal?.aborted) {
      return
    }

    // maxTurns 检查（对标 Claude Code max_turns_reached）
    if (turnCount >= maxTurns) {
      yield { type: 'messages_snapshot', messages: [...currentMessages] }
      yield { type: 'max_turns_reached', turnCount }
      return
    }

    // 每轮 API 调用开始前通知（对标 Claude Code stream_request_start）
    yield { type: 'stream_request_start' }
    turnCount++

    // ── 单轮流式调用 ────────────────────────────────────────────────────────
    let assistantContent: AssistantMessage['content']
    try {
      assistantContent = yield* streamOneTurn(client, {
        model,
        systemPrompt,
        messages: currentMessages,
        tools,
        abortSignal,
      })
    } catch (err) {
      await executeHooks({
        hook_event_name: 'StopFailure',
        error: err instanceof Error ? err.message : String(err),
        session_id: sessionId,
        cwd: toolUseContext.cwd,
      })
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }

    // 将 assistant 消息追加到历史
    currentMessages.push({ type: 'assistant', content: assistantContent })

    // ── 检查是否有工具调用 ──────────────────────────────────────────────────
    const toolUses = assistantContent.filter((c) => c.type === 'tool_use')
    if (toolUses.length === 0) {
      // 无工具调用 → 对话结束，先快照当前完整消息供下一轮使用
      yield { type: 'messages_snapshot', messages: [...currentMessages] }
      await executeHooks({
        hook_event_name: 'Stop',
        stop_reason: 'done',
        session_id: sessionId,
        cwd: toolUseContext.cwd,
        messages: currentMessages,
      })
      yield { type: 'done' }
      return
    }

    // ── 执行工具（含权限检查）──────────────────────────────────────────────
    const toolResults = yield* executeTools(assistantContent, tools, canUseTool, toolUseContext, sessionId)

    // tool_result 作为 user 消息回灌给模型，这是 Anthropic 工具调用协议要求的格式。
    currentMessages.push({ type: 'user', content: toolResults })

    // Todo reminder 注入（对标 Claude Code getTodoReminderAttachments）
    // 上下文压缩后 todo_write 历史消失，turnsSinceLastTodoWrite 会变大，
    // 触发注入让模型重新感知当前任务状态。
    const todoReminder = buildTodoReminderIfNeeded(
      currentMessages,
      getAppState().todos,
    )
    if (todoReminder) {
      currentMessages.push(todoReminder)
    }
  }
}
