// 核心主循环 — 对标 Claude Code src/query.ts + QueryEngine.ts
// 纯 async generator，与 React 无关
// 职责：调 API → 流式接收 → 权限检查 → 执行工具 → yield StreamEvent

import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { createAnthropicClient } from './anthropic.js'
import type { Tool, ToolUseContext } from './Tool.js'
import type { Message, StreamEvent, UserMessage, AssistantMessage } from './types/message.js'
import { hasUltrathinkKeyword, getThinkingParams } from './utils/thinking.js'
import { getAppState, setAppState } from './state/AppState.js'
import { buildTodoReminderIfNeeded } from './state/todoReminder.js'
import { findTool } from './tools/index.js'
import { initTaskStore } from './tasks/taskFileStore.js'
import {
  autoCompactIfNeeded,
  createAutoCompactTracking,
  getAutoCompactThreshold,
  type AutoCompactTracking,
} from './compact/autoCompact.js'
import { runPostCompactCleanup } from './compact/postCompactCleanup.js'
import { snipIfNeeded } from './compact/snip.js'
import { microcompactIfNeeded } from './compact/microcompact.js'
import { executeHooks } from './hooks/index.js'
import {
  createContentReplacementState,
  enforceToolResultBudget,
  processToolResult,
  DEFAULT_MAX_RESULT_SIZE_CHARS,
} from './utils/toolResultStorage.js'
import { registerMessageId } from './utils/messageIds.js'
import { isSnipped } from './utils/snipStore.js'
import { isRetryable, getRetryDelay } from './utils/apiRetry.js'

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

/**
 * 在 user message content 的最后一个 text block 末尾追加 [id:xxx] 标签。
 * 只修改 SDK 副本，不改原始 msg。
 */
function appendIdTag(
  content: Anthropic.MessageParam['content'],
  shortId: string,
): Anthropic.MessageParam['content'] {
  const tag = `\n[id:${shortId}]`
  if (typeof content === 'string') {
    return content + tag
  }
  if (!Array.isArray(content) || content.length === 0) {
    return content
  }
  // Find last text block and append tag
  const blocks = [...content] as Anthropic.ContentBlockParam[]
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]!
    if (block.type === 'text') {
      blocks[i] = { ...block, text: block.text + tag }
      return blocks
    }
  }
  // No text block found — append a new one
  return [...blocks, { type: 'text', text: tag }]
}

/**
 * 将 Pi 的 Message[] 转换为 Anthropic SDK 格式。
 * 对非 meta 的 user message 注入 [id:xxx] 标签，让模型能通过 SnipTool 引用。
 */
function toSDKMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages
    .filter((msg): msg is Exclude<Message, { type: 'compact_boundary' }> => msg.type !== 'compact_boundary')
    .map((msg) => {
      if (msg.type === 'user' && msg.uuid && !msg.isMeta) {
        const shortId = registerMessageId(msg.uuid)
        return {
          role: 'user' as const,
          content: appendIdTag(msg.content as Anthropic.MessageParam['content'], shortId),
        }
      }
      return {
        role: msg.type as 'user' | 'assistant',
        content: msg.content as Anthropic.MessageParam['content'],
      }
    })
}

/**
 * 取最后一个 compact_boundary 之后的消息（对标 CC getMessagesAfterCompactBoundary）。
 * 同时过滤掉被 SnipTool 标记删除的消息。
 */
function getMessagesAfterCompactBoundary(messages: Message[]): Message[] {
  let startIdx = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.type === 'compact_boundary') {
      startIdx = i
      break
    }
  }
  const sliced = startIdx === 0 ? messages : messages.slice(startIdx)
  // Filter out messages marked as snipped by SnipTool
  return sliced.filter(msg => msg.type !== 'user' || !msg.uuid || !isSnipped(msg.uuid))
}

// ── 单轮流式调用（对标 Claude Code claude.ts 中的 API 流）─────────────────────

/**
 * 对 API 发起一轮流式请求，累积 assistantContent 并 yield 文本 delta。
 * 返回完整的 assistantContent 供调用方追加到消息历史。
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
): AsyncGenerator<StreamEvent, { content: AssistantMessage['content']; stopReason: string | null }> {
  const { model, systemPrompt, messages, tools, abortSignal } = params

  const thinkingParams = getThinkingParams(model)

  const sdkMessages = toSDKMessages(messages)
  const sdkTools = tools.map(toSDKTool)

  const stream = client.messages.stream(
    {
      model,
      system: systemPrompt,
      messages: sdkMessages,
      tools: sdkTools,
      max_tokens: thinkingParams.thinking
        ? thinkingParams.max_tokens ?? 16000
        : 16000,
      ...(thinkingParams.thinking ? { thinking: thinkingParams.thinking } : {}),
    },
    { signal: abortSignal },
  )

  const assistantContent: AssistantMessage['content'] = []
  let stopReason: string | null = null

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      if (event.content_block.type === 'text') {
        assistantContent.push({ type: 'text', text: '' })
      } else if (event.content_block.type === 'thinking') {
        assistantContent.push({ type: 'thinking', thinking: '' })
      } else if (event.content_block.type === 'tool_use') {
        assistantContent.push({
          type: 'tool_use',
          id: event.content_block.id,
          name: event.content_block.name,
          input: {},
        })
      }
    } else if (event.type === 'content_block_delta') {
      const last = assistantContent[assistantContent.length - 1]
      if (!last) continue
      if (event.delta.type === 'text_delta' && last.type === 'text') {
        last.text += event.delta.text
        yield { type: 'text_delta', delta: event.delta.text }
      } else if (event.delta.type === 'thinking_delta' && last.type === 'thinking') {
        last.thinking += event.delta.thinking
        yield { type: 'thinking_delta', delta: event.delta.thinking }
      } else if (event.delta.type === 'input_json_delta' && last.type === 'tool_use') {
        // Accumulate JSON string for tool input
        if (!('_inputJson' in last)) {
          (last as { _inputJson?: string })._inputJson = ''
        }
        ;(last as { _inputJson?: string })._inputJson! += event.delta.partial_json
      }
    } else if (event.type === 'content_block_stop') {
      const last = assistantContent[assistantContent.length - 1]
      if (last?.type === 'tool_use' && '_inputJson' in last) {
        try {
          last.input = JSON.parse((last as { _inputJson?: string })._inputJson ?? '{}')
        } catch {
          last.input = {}
        }
        delete (last as { _inputJson?: string })._inputJson
      }
    } else if (event.type === 'message_delta') {
      stopReason = event.delta.stop_reason ?? null
    }
  }

  return { content: assistantContent, stopReason }
}

// ── 工具执行 ──────────────────────────────────────────────────────────────────

const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

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
        // 仍然补一条 tool_result，保证模型下一轮能看到"工具未执行"的结果。
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
        // Layer 1: 超大结果写磁盘，返回 <persisted-output> 预览
        result = await processToolResult(
          c.id,
          c.name,
          result,
          tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS,
        )
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

// ── 默认 canUseTool ────────────────────────────────────────────────────────────

async function defaultCanUseTool(_name: string, _input: unknown): Promise<'allow' | 'deny'> {
  return 'allow'
}

// ── 主循环（对标 Claude Code queryLoop）──────────────────────────────────────

/**
 * 核心主循环：调用 API，流式 yield 事件，支持多轮工具调用。
 *
 * messages 语义（对标 CC state.messages）：
 *   - working set，存储 boundary 之后的内容
 *   - 每轮末尾重建：messages = [...messagesForQuery, ...assistant, ...toolResults]
 *   - snip/microcompact 结果通过轮末重建自动持久化，下一轮不重复计算
 *   - autocompact 成功后 messagesForQuery = postCompactMessages，messages 随之缩短
 */
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  const {
    messages: initialMessages,
    tools,
    allTools,
    systemPrompt,
    model = process.env.PI_MODEL ?? 'deepseek-chat',
    maxTurns,
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

  const toolUseContext: ToolUseContext = {
    abortSignal: abortSignal ?? new AbortController().signal,
    cwd: process.cwd(),
    tools: allTools ?? tools,
    getAppState,
    setAppState,
    askUser,
    enterPlanMode,
    exitPlanMode,
    verifyExecution,
    onExit,
  }

  const client = createAnthropicClient()

  // working set — 对标 CC state.messages
  // 初始值来自调用方（REPL 传入 conversationRef.current）
  // Stamp any user messages that don't have a uuid yet (e.g. the new message from REPL)
  let messages: Message[] = initialMessages.map(msg =>
    msg.type === 'user' && !msg.uuid && !msg.isMeta
      ? { ...msg, uuid: randomUUID() }
      : msg,
  )
  let turnCount = 0
  let maxTokensRecoveryAttempts = 0
  let apiRetryAttempts = 0
  const replacementState = createContentReplacementState()
  // Per-query tracking，不跨 session 污染
  let tracking: AutoCompactTracking = createAutoCompactTracking()

  // ── 主循环 ────────────────────────────────────────────────────────────────
  while (true) {
    // 每轮从 working set 中取 boundary 之后的消息，过滤 snipped 消息
    let messagesForQuery = getMessagesAfterCompactBoundary(messages)

    // Layer 2: 卸载大工具结果（让 autoCompact token 计算更准确）
    messagesForQuery = await enforceToolResultBudget(messagesForQuery, replacementState)

    // Snip: 截断超出上下文窗口的旧消息（结果通过轮末重建写回 messages）
    const snipResult = snipIfNeeded(messagesForQuery, getAutoCompactThreshold())
    if (snipResult.didSnip) {
      messagesForQuery = snipResult.messages
      yield { type: 'snip_done', messagesRemoved: snipResult.messagesRemoved, tokensFreed: snipResult.tokensFreed }
    }

    // Microcompact: 清空旧 tool_result 内容（time-based）
    const mcResult = microcompactIfNeeded(messagesForQuery)
    if (mcResult.toolsCleared > 0) {
      messagesForQuery = mcResult.messages
      yield { type: 'microcompact_done', toolsCleared: mcResult.toolsCleared, tokensSaved: mcResult.tokensSaved }
    }

    // Autocompact: token 超阈值时调 API 做摘要压缩
    const compactResult = await autoCompactIfNeeded(
      messagesForQuery,
      tracking,
      { snipTokensFreed: snipResult.tokensFreed },
    )
    tracking = compactResult.tracking
    if (compactResult.wasCompacted && compactResult.result) {
      messagesForQuery = compactResult.result.newMessages
      runPostCompactCleanup()
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

    yield { type: 'stream_request_start' }

    // ── 单轮流式调用 ────────────────────────────────────────────────────────
    let assistantContent: AssistantMessage['content']
    let stopReason: string | null
    try {
      ;({ content: assistantContent, stopReason } = yield* streamOneTurn(client, {
        model,
        systemPrompt,
        messages: messagesForQuery,
        tools,
        abortSignal,
      }))
    } catch (err) {
      if (isRetryable(err) && apiRetryAttempts < 5) {
        apiRetryAttempts++
        const delay = getRetryDelay(apiRetryAttempts)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay)
          abortSignal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')) }, { once: true })
        })
        continue
      }
      apiRetryAttempts = 0
      await executeHooks({
        hook_event_name: 'StopFailure',
        error: err instanceof Error ? err.message : String(err),
        session_id: sessionId,
        cwd: toolUseContext.cwd,
      })
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }
    apiRetryAttempts = 0

    // assistant 消息追加到 messagesForQuery（含 timestamp，供 microcompact 使用）
    const assistantMsg: AssistantMessage = {
      type: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
    }

    // ── max_tokens 续写恢复 ────────────────────────────────────────────────
    if (stopReason === 'max_tokens') {
      if (maxTokensRecoveryAttempts < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
        maxTokensRecoveryAttempts++
        const recoveryMsg: UserMessage = {
          type: 'user',
          content: [{
            type: 'text',
            text: 'Output token limit hit. Resume directly — no apology, no recap of what you were doing. Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.',
          }],
          isMeta: true,
        }
        // 轮末重建（对标 CC continue site）
        messages = [...messagesForQuery, assistantMsg, recoveryMsg]
        continue
      }
      // 超过重试上限
      messages = [...messagesForQuery, assistantMsg]
      yield { type: 'messages_snapshot', messages: [...messages] }
      yield { type: 'output_truncated' }
      return
    }

    maxTokensRecoveryAttempts = 0

    // ── 检查是否有工具调用 ──────────────────────────────────────────────────
    if (stopReason !== 'tool_use') {
      // 无工具调用 → 对话结束，轮末重建后 yield 快照
      messages = [...messagesForQuery, assistantMsg]
      yield { type: 'messages_snapshot', messages: [...messages] }
      const stopHookResult = await executeHooks({
        hook_event_name: 'Stop',
        stop_reason: 'done',
        session_id: sessionId,
        cwd: toolUseContext.cwd,
        messages,
      })
      // Stop hook blocking 重试（对标 CC blockingErrors）
      if (stopHookResult.blockingErrors?.length) {
        messages = [...messages, ...stopHookResult.blockingErrors]
        continue
      }
      yield { type: 'done' }
      return
    }

    // ── 执行工具（含权限检查）──────────────────────────────────────────────
    const toolResultContent = yield* executeTools(assistantContent, tools, canUseTool, toolUseContext, sessionId)

    const toolResultMsg: UserMessage = {
      type: 'user',
      content: toolResultContent,
    }

    // Todo reminder 注入
    const todoReminder = buildTodoReminderIfNeeded(
      [...messagesForQuery, assistantMsg, toolResultMsg],
      getAppState().todos,
    )

    // 轮末重建 messages（对标 CC continue site）
    // snip/microcompact 结果通过 messagesForQuery 自动持久化
    if (todoReminder) {
      messages = [...messagesForQuery, assistantMsg, toolResultMsg, todoReminder]
    } else {
      messages = [...messagesForQuery, assistantMsg, toolResultMsg]
    }

    // 每轮工具调用后 yield 快照，让 REPL conversationRef 保持最新
    yield { type: 'messages_snapshot', messages: [...messages] }

    // 对标 CC：用户 Ctrl+C 中断（interrupt）时，工具已执行完但不继续下一轮
    if (abortSignal?.aborted && abortSignal.reason === 'interrupt') {
      yield { type: 'done' }
      return
    }

    // maxTurns 检查
    if (maxTurns && turnCount >= maxTurns) {
      yield { type: 'max_turns_reached', turnCount }
      return
    }

    turnCount++
  }
}
