// 主屏幕 — 简化版，对标 Claude Code src/screens/REPL.tsx
// 目标 ≤300 行。职责：驱动 query 循环，处理 StreamEvent，协调 UI

import { randomUUID } from 'crypto'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { query, type CanUseTool } from '../query.js'
import { getSystemPrompt, initSystemPrompt, clearSectionCache, type SectionContext } from '../constants/prompts.js'
import { clearSnipStore } from '../utils/snipStore.js'
import { clearMessageIds } from '../utils/messageIds.js'
import { executeHooks } from '../hooks/index.js'
import { useMergedTools } from '../hooks/useMergedTools.js'
import { getAllTools, findTool } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'
import { getAppState, setAppState } from '../state/AppState.js'
import { useAssistantHistory } from '../hooks/useAssistantHistory.js'
import { Messages, EMPTY_COLLAPSE, type CollapseState } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import type { SSHSession } from '../ssh/index.js'
import type { SwarmConfig } from '../swarm/index.js'
import type { ToolUseContext } from '../Tool.js'
import type { Message } from '../types/message.js'
import { createCronScheduler } from '../cron/cronScheduler.js'
import { compactConversation, partialCompactConversation } from '../compact/index.js'
import { runPostCompactCleanup } from '../compact/postCompactCleanup.js'
import { initSessionMemory } from '../sessionMemory/index.js'
import { initObservability } from '../observability/index.js'
import { initPermissions, checkToolPermission, applyPermissionUpdate, persistPermissionUpdate } from '../permissions/index.js'
import { PermissionPrompt, PERMISSION_OPTIONS, type PermissionPromptRequest } from '../components/PermissionPrompt.js'
import type { PermissionUserChoice } from '../permissions/types.js'
import { getWorkDir, getSessionId, getWorkspaceDir } from '../bootstrap/state.js'
import { addToHistory } from '../history.js'
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { listSkills, type Skill } from '../skills/index.js'
import { dispatchSlashCommand, type CommandContext } from '../commands/index.js'
import '../commands/clear.js'
import '../commands/help.js'
import '../commands/compact.js'
import '../commands/report.js'
import '../commands/exit.js'
import '../commands/dream.js'
import '../commands/dashboard.js'

type Props = {
  // Stub props — 接口预留，当前不使用
  sshSession?: SSHSession
  swarmConfig?: SwarmConfig
}

type PermissionRequest = PermissionPromptRequest

type AskUserRequest = {
  question: string
  options: ReadonlyArray<{ label: string; description?: string }>
  resolve: (answer: string) => void
}

type PlanApprovalRequest = {
  plan: string
  resolve: (result: string) => void
}

type VerifyRequest = {
  summary: string
  resolve: (result: string) => void
}

const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'bash'])

// 初始化系统提示词注册表（模块加载时执行一次）
initSystemPrompt()

export function emitSessionEndLog(reason: 'exit_command' | 'clear'): void {
  logForDebugging(`session ended reason=${reason}`)
  logForDiagnosticsNoPII('info', 'session_end', { reason })
}

export function emitCompactTriggeredLog(): void {
  logForDebugging('compact triggered')
  logForDiagnosticsNoPII('info', 'compact_triggered')
}

export function maybeLogStreamingIdleWarning(
  now: number,
  streamStartTs: number,
  streamIdleWarningFired: boolean,
): boolean {
  if (!streamIdleWarningFired && now - streamStartTs > 30_000) {
    const duration_ms = now - streamStartTs
    logForDebugging(`streaming idle ${duration_ms}ms`, { level: 'warn' })
    logForDiagnosticsNoPII('warn', 'streaming_idle_warning', { duration_ms })
    return true
  }

  return streamIdleWarningFired
}

export function REPL(_props: Props) {
  const { stdout } = useStdout()
  const tools = useMergedTools()
  const allTools = useMemo(() => getAllTools(getPluginTools()), [])
  const history = useAssistantHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [permSelectedIndex, setPermSelectedIndex] = useState(0)
  const [isPlanMode, setIsPlanMode] = useState(false)
  const [planApprovalRequest, setPlanApprovalRequest] = useState<PlanApprovalRequest | null>(null)
  const [collectingPlanReason, setCollectingPlanReason] = useState(false)
  const [verifyRequest, setVerifyRequest] = useState<VerifyRequest | null>(null)
  const [collectingVerifyReason, setCollectingVerifyReason] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)
  const [lastCompactInfo, setLastCompactInfo] = useState<{ savedTokens: number } | null>(null)
  const [isPartialSelectMode, setIsPartialSelectMode] = useState(false)
  const [partialSelectedIndex, setPartialSelectedIndex] = useState(0)
  const [skills, setSkills] = useState<Skill[]>([])
  const [scrollOffset, setScrollOffset] = useState(0)
  // 折叠状态 — 工具组/思考/回复的展开/折叠
  const [collapse, setCollapse] = useState<CollapseState>(EMPTY_COLLAPSE)
  const sessionIdRef = useRef<string>(randomUUID())

  // AbortController — 用于 Ctrl+C 中止当前 query（对标 Claude Code interrupt()）
  const abortControllerRef = useRef<AbortController | null>(null)
  // Ref for stale-closure-safe canUseTool access
  const isPlanModeRef = useRef(false)
  // Refs for cron scheduler (stale-closure-safe)
  const handleSubmitRef = useRef<(input: string) => Promise<void>>(async () => {})
  const isLoadingRef = useRef(false)
  // 对话消息 ref — 存储 query() 内部维护的正确顺序消息，用于下一轮 API 调用
  // 不使用 history.messages，因为 history 是显示用的，工具调用时顺序与 API 要求不一致
  const conversationRef = useRef<Message[]>([])
  const smInitializedRef = useRef(false)
  const streamStartTsRef = useRef<number>(0)
  const streamIdleWarningFiredRef = useRef(false)
  // Ref for permission context — 确保 canUseTool 总是使用最新的权限规则
  const permissionContextRef = useRef(getAppState().permissionContext)

  // ── canUseTool 回调（传给 query()，在工具执行前弹出确认 UI）─────────────────
  // 对标 Claude Code canUseTool / wrappedCanUseTool
  const canUseTool = useCallback<CanUseTool>(
    async (name, input) => {
      // Plan mode blocks writes (existing behavior preserved)
      if (isPlanModeRef.current && WRITE_TOOLS.has(name)) {
        return 'deny'
      }

      const tool = findTool(name, allTools)
      if (!tool) return 'allow'

      // Build content string for rule matching (Investment-specific)
      let contentString: string | undefined
      const inp = input as Record<string, unknown>
      if (name === 'Investment' && inp.function && inp.action) {
        contentString = `${inp.function}:${inp.action}`
      }

      // 使用 ref 而不是 getAppState()，确保使用最新的权限规则
      const decision = checkToolPermission(
        tool,
        inp,
        permissionContextRef.current,
        contentString,
      )

      if (decision.behavior === 'allow') return 'allow'
      if (decision.behavior === 'deny') return 'deny'

      // behavior === 'ask' → show permission prompt
      const userChoice = await new Promise<PermissionUserChoice>((resolve) => {
        setPermSelectedIndex(0)
        setPermissionRequest({
          toolName: name,
          input,
          decision,
          resolve,
        })
      })

      // Handle persistence
      if (userChoice.persist && decision.suggestions?.length) {
        const baseSuggestion = decision.suggestions[0]!
        const update = {
          ...baseSuggestion,
          behavior: userChoice.action as 'allow' | 'deny',
        }
        persistPermissionUpdate(update)

        // 立即更新 ref，确保下次调用时生效
        const newContext = applyPermissionUpdate(permissionContextRef.current, update)
        permissionContextRef.current = newContext

        // 同时更新 AppState
        setAppState(prev => ({
          ...prev,
          permissionContext: newContext,
        }))
      }

      setPermissionRequest(null)
      return userChoice.action
    },
    [allTools],
  )

  const askUser = useCallback<NonNullable<ToolUseContext['askUser']>>(
    (question, options) =>
      new Promise((resolve) => {
        setSelectedIndex(0)
        setAskUserRequest({ question, options, resolve })
      }),
    [],
  )

  const resetSession = useCallback(() => {
    void executeHooks({
      hook_event_name: 'SessionEnd',
      exit_reason: 'clear',
      session_id: sessionIdRef.current,
      cwd: process.cwd(),
    })
    sessionIdRef.current = randomUUID()
    emitSessionEndLog('clear')
    void executeHooks({
      hook_event_name: 'SessionStart',
      source: 'clear',
      session_id: sessionIdRef.current,
      cwd: process.cwd(),
    })
    clearSectionCache()
    clearSnipStore()
    clearMessageIds()
    history.clearMessages()
    conversationRef.current = []
  }, [history])

  const runCompact = useCallback(async (sessionId: string) => {
    emitCompactTriggeredLog()
    setIsLoading(true)
    isLoadingRef.current = true
    try {
      const result = await compactConversation(conversationRef.current, {
        suppressFollowUpQuestions: false,
        sessionId,
      })
      conversationRef.current = result.newMessages
      runPostCompactCleanup()
      history.appendUserMessage(
        `[System: Conversation compacted. Saved ~${result.savedTokens.toLocaleString()} tokens]`,
      )
    } catch (err) {
      history.appendUserMessage(
        `[System: Compact failed — ${err instanceof Error ? err.message : String(err)}]`,
      )
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [history])

  const enterPartialCompact = useCallback((pivotIndex: number) => {
    setPartialSelectedIndex(pivotIndex)
    setIsPartialSelectMode(true)
  }, [])

  const doExit = useCallback(async () => {
    await executeHooks({
      hook_event_name: 'SessionEnd',
      exit_reason: 'exit_command',
      session_id: sessionIdRef.current,
      cwd: process.cwd(),
    })
    emitSessionEndLog('exit_command')
    process.exit(0)
  }, [])

  const enterPlanMode = useCallback(() => {
    setIsPlanMode(true)
    isPlanModeRef.current = true
    return Promise.resolve()
  }, [])

  const exitPlanMode = useCallback(
    (plan: string) =>
      new Promise<string>((promiseResolve) => {
        setPlanApprovalRequest({
          plan,
          resolve: (result) => {
            if (result === 'approved') {
              // Rejected intentionally keeps plan mode active so model can revise
              setIsPlanMode(false)
              isPlanModeRef.current = false
            }
            setCollectingPlanReason(false)
            setPlanApprovalRequest(null)
            promiseResolve(result)
          },
        })
      }),
    [],
  )

  const verifyExecution = useCallback(
    (summary: string) =>
      new Promise<string>((promiseResolve) => {
        setVerifyRequest({
          summary,
          resolve: (result) => {
            setCollectingVerifyReason(false)
            setVerifyRequest(null)
            promiseResolve(result)
          },
        })
      }),
    [],
  )

  // ── 处理用户提交 ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort('interrupt')
  }, [])

  const handleSubmit = useCallback(
    async (input: string) => {
      // 如果正在执行，先中断当前查询（支持中断续传）
      if (isLoadingRef.current) {
        abortControllerRef.current?.abort('interrupt')
        // 等待当前查询完全结束
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // ── slash commands ──────────────────────────────────────────────────
      const originalInput = input
      if (input.startsWith('/')) {
        const commandCtx: CommandContext = {
          history,
          conversationRef,
          sessionIdRef,
          doExit,
          resetSession,
          runCompact,
          enterPartialCompact,
        }
        const { handled, expandedInput } = await dispatchSlashCommand(input, commandCtx)
        if (handled) return
        // skill 展开：expandedInput 发给 API，originalInput 用于显示和历史
        if (expandedInput !== undefined) {
          input = expandedInput
        }
      }

      const displayInput = originalInput
      const queryInput = input

      await executeHooks({
        hook_event_name: 'UserPromptSubmit',
        prompt: displayInput,
        session_id: sessionIdRef.current,
        cwd: process.cwd(),
      })

      addToHistory(displayInput)
      history.appendUserMessage(displayInput)
      setScrollOffset(0)
      setIsLoading(true)
      isLoadingRef.current = true
      history.startAssistantMessage()

      // 创建新的 AbortController（对标 Claude Code createAbortController）
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        // 使用 conversationRef 而非 history.messages：
        // history.messages 仅用于显示，工具调用时消息顺序与 API 要求不一致；
        // conversationRef 存储 query() 内部 currentMessages 的快照，顺序始终正确。
        const currentMessages = [
          ...conversationRef.current,
          { type: 'user' as const, content: [{ type: 'text' as const, text: queryInput }] },
        ]

        const gen = query({
          messages: currentMessages,
          tools,
          allTools,
          systemPrompt: await getSystemPrompt({
            cwd: getWorkDir(),
            sessionId: getSessionId(),
            workspaceDir: getWorkspaceDir(),
            isPlanMode: isPlanModeRef.current,
          } satisfies SectionContext),
          canUseTool,
          askUser,
          enterPlanMode,
          exitPlanMode,
          verifyExecution,
          onExit: doExit,
          abortSignal: abortController.signal,
          sessionId: sessionIdRef.current,
        })

        streamStartTsRef.current = Date.now()
        streamIdleWarningFiredRef.current = false

        for await (const event of gen) {
          const now = Date.now()
          streamIdleWarningFiredRef.current = maybeLogStreamingIdleWarning(
            now,
            streamStartTsRef.current,
            streamIdleWarningFiredRef.current,
          )
          streamStartTsRef.current = now

          switch (event.type) {
            // ── 生命周期 ────────────────────────────────────────────────
            case 'stream_request_start':
              // API 调用开始，UI 已在 isLoading 状态，无需额外操作
              break

            case 'messages_snapshot':
              // 保存 query() 内部的完整消息快照，供下一轮 API 调用使用
              conversationRef.current = event.messages
              break

            case 'done':
              history.finalizeAssistantMessage()
              // 工具调用现在单独显示（对标 Claude Code），不再需要展开 tool group
              break
              break

            case 'max_turns_reached':
              history.finalizeAssistantMessage()
              history.appendUserMessage(`[System: reached ${event.turnCount} turn limit]`)
              break

            case 'output_truncated':
              history.finalizeAssistantMessage()
              history.appendUserMessage('[System: output token limit reached, response may be incomplete]')
              break

            case 'error':
              history.finalizeAssistantMessage()
              console.error('Query error:', event.error)
              break

            case 'compact_start':
              setIsCompacting(true)
              break

            case 'compact_done':
              setIsCompacting(false)
              setLastCompactInfo({ savedTokens: event.savedTokens })
              break

            // ── 扩展思考 ────────────────────────────────────────────────
            case 'thinking_delta':
              history.appendThinkingDelta(event.delta)
              break

            // ── 流式文本 ────────────────────────────────────────────────
            case 'text_delta':
              history.appendStreamingDelta(event.delta)
              break

            // ── 工具调用 ────────────────────────────────────────────────
            // tool_use 在 canUseTool 返回 allow 之后才 yield，此处只做 UI 展示
            case 'tool_use':
              // 工具正在执行（权限已通过），记录 tool_use block 到 assistant message
              history.appendToolUse(event.id, event.name, event.input)
              break

            case 'tool_result':
              history.appendToolResult(event.tool_use_id, event.content)
              break

            case 'tool_denied':
              // 用户拒绝，关闭 permission UI
              setPermissionRequest(null)
              break
          }
        }
      } finally {
        setIsLoading(false)
        isLoadingRef.current = false
        abortControllerRef.current = null
      }
    },
    [tools, history, canUseTool, askUser, doExit, enterPlanMode, exitPlanMode, verifyExecution, resetSession, runCompact, enterPartialCompact],
  )

  // Keep ref in sync with latest handleSubmit (stale-closure-safe for cron scheduler)
  handleSubmitRef.current = handleSubmit

  useEffect(() => {
    if (!smInitializedRef.current) {
      smInitializedRef.current = true
      initSessionMemory()
      initObservability()
      initPermissions()
      // 初始化后同步 permissionContext ref
      permissionContextRef.current = getAppState().permissionContext
    }

    // 加载 skill 列表，供命令面板显示
    void listSkills(process.cwd()).then(setSkills).catch(() => {})

    void executeHooks({
      hook_event_name: 'SessionStart',
      source: 'startup',
      session_id: sessionIdRef.current,
      cwd: process.cwd(),
    })

    return () => {
      void executeHooks({
        hook_event_name: 'SessionEnd',
        session_id: sessionIdRef.current,
        cwd: process.cwd(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cron scheduler ────────────────────────────────────────────────────────
  useEffect(() => {
    const scheduler = createCronScheduler({
      onFire: (prompt) => { void handleSubmitRef.current(prompt) },
      isLoading: () => isLoadingRef.current,
    })
    scheduler.start()
    return () => scheduler.stop()
  }, [])

  // ── 键盘输入处理 ──────────────────────────────────────────────────────────
  useInput(
    (input, key) => {
      if (isPartialSelectMode) {
          if (key.upArrow || input === 'k') {
            setPartialSelectedIndex((i) => Math.max(0, i - 1))
          } else if (key.downArrow || input === 'j') {
            setPartialSelectedIndex((i) =>
              Math.min(history.displayMessages.length - 1, i + 1),
            )
          } else if (input === 'f') {
            // compact from selected message
            setIsPartialSelectMode(false)
            void (async () => {
              setIsLoading(true)
              isLoadingRef.current = true
              try {
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'from',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                runPostCompactCleanup()
                history.appendUserMessage(
                  `[System: Partial compact (from). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
              } catch (err) {
                history.appendUserMessage(
                  `[System: Partial compact failed — ${err instanceof Error ? err.message : String(err)}]`,
                )
              } finally {
                setIsLoading(false)
                isLoadingRef.current = false
              }
            })()
          } else if (input === 'u') {
            // compact up to selected message
            setIsPartialSelectMode(false)
            void (async () => {
              setIsLoading(true)
              isLoadingRef.current = true
              try {
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'up_to',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                runPostCompactCleanup()
                history.appendUserMessage(
                  `[System: Partial compact (up to). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
              } catch (err) {
                history.appendUserMessage(
                  `[System: Partial compact failed — ${err instanceof Error ? err.message : String(err)}]`,
                )
              } finally {
                setIsLoading(false)
                isLoadingRef.current = false
              }
            })()
          } else if (key.escape) {
            setIsPartialSelectMode(false)
          }
          return
        }

      if (askUserRequest) {
        if (key.upArrow) {
          setSelectedIndex((i) => Math.max(0, i - 1))
        } else if (key.downArrow) {
          setSelectedIndex((i) => Math.min(askUserRequest.options.length - 1, i + 1))
        } else if (key.return) {
          const answer = askUserRequest.options[selectedIndex]?.label ?? ''
          setAskUserRequest(null)
          askUserRequest.resolve(answer)
        }
        return
      }

      if (collectingPlanReason || collectingVerifyReason) {
        // PromptInput handles typing; don't intercept here
        return
      }

      if (planApprovalRequest) {
        if (input === 'y' || key.return) {
          planApprovalRequest.resolve('approved')
        } else if (input === 'n' || key.escape) {
          planApprovalRequest.resolve('rejected')
        } else if (input === 'r') {
          setCollectingPlanReason(true)
        }
        return
      }

      if (verifyRequest) {
        if (input === 'y' || key.return) {
          verifyRequest.resolve('verified')
        } else if (input === 'n' || key.escape) {
          verifyRequest.resolve('rejected')
        } else if (input === 'r') {
          setCollectingVerifyReason(true)
        }
        return
      }

      // 权限确认 (4-option prompt)
      if (permissionRequest) {
        if (key.upArrow) {
          setPermSelectedIndex(i => Math.max(0, i - 1))
        } else if (key.downArrow) {
          setPermSelectedIndex(i => Math.min(PERMISSION_OPTIONS.length - 1, i + 1))
        } else if (key.return) {
          const opt = PERMISSION_OPTIONS[permSelectedIndex]!
          permissionRequest.resolve({
            action: opt.action,
            persist: opt.persist,
            destination: opt.persist ? 'projectSettings' : undefined,
          })
        } else if (key.escape) {
          permissionRequest.resolve({ action: 'deny', persist: false })
        }
        return
      }

      // Ctrl+C / ESC 中止当前 query（对标 CC chat:cancel 加载中行为）
      if (isLoading && (key.escape || (key.ctrl && input === 'c'))) {
        abortControllerRef.current?.abort('interrupt')
        return
      }

      // 滚动消息历史：PageUp/PageDown（Ink 原生支持，无兼容问题）+ Ctrl+↑/↓ 作为备用
      if (!isLoading && !permissionRequest && !askUserRequest && !planApprovalRequest && !verifyRequest) {
        const SCROLL_STEP = 5
        const PAGE_STEP = (stdout?.rows ?? 24) - 8 // 大约一屏

        if (key.pageUp) {
          setScrollOffset((o) => o + PAGE_STEP)
          return
        }
        if (key.pageDown) {
          setScrollOffset((o) => Math.max(0, o - PAGE_STEP))
          return
        }
        if (key.ctrl && key.upArrow) {
          setScrollOffset((o) => o + SCROLL_STEP)
          return
        }
        if (key.ctrl && key.downArrow) {
          setScrollOffset((o) => Math.max(0, o - SCROLL_STEP))
          return
        }

        // Ctrl+G — 工具调用现在始终显示（对标 Claude Code），不再需要 toggle
        // 保留此快捷键位，留作将来扩展


        // Ctrl+E — toggle ALL assistant messages expand/collapse
        if (key.ctrl && input === 'e') {
          const msgs = history.displayMessages
          const assistantIndices: number[] = []
          for (let i = 0; i < msgs.length; i++) {
            if (msgs[i].type === 'assistant') assistantIndices.push(i)
          }
          // 排除最后一个（最新回复由 isLatest 自动展开）
          // Ctrl+E 控制非最新的 assistant 展开/折叠
          if (assistantIndices.length === 0) return

          setCollapse((prev) => {
            const allExpanded = assistantIndices.every(idx => prev.expandedAssistants.has(idx))
            const next = new Set(prev.expandedAssistants)
            if (allExpanded) {
              for (const idx of assistantIndices) next.delete(idx)
            } else {
              for (const idx of assistantIndices) next.add(idx)
            }
            return { ...prev, expandedAssistants: next }
          })
          return
        }

        // Ctrl+T — toggle ALL thinking groups expand/collapse
        if (key.ctrl && input === 't') {
          const msgs = history.displayMessages
          // 每个有 thinking 的 assistant 算一个 thinking group
          let totalThinkingGroups = 0
          for (const msg of msgs) {
            if (msg.type === 'assistant' && msg.content.some(c => c.type === 'thinking')) {
              totalThinkingGroups++
            }
          }
          if (totalThinkingGroups === 0) return

          setCollapse((prev) => {
            const allExpanded = prev.expandedThinkings.size >= totalThinkingGroups
            const next = new Set<number>()
            if (!allExpanded) {
              for (let i = 0; i < totalThinkingGroups; i++) next.add(i)
            }
            return { ...prev, expandedThinkings: next }
          })
          return
        }
      }
    },
    { isActive: true },
  )

  return (
    <Box flexDirection="column" height="100%">
      {/* 状态栏 */}
      <StatusBar
        messageCount={history.displayMessages.length}
        isStreaming={isLoading}
        isPlanMode={isPlanMode}
      />

      {/* 消息历史区 — 占据剩余空间 */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Messages
          messages={history.displayMessages}
          tools={tools}
          maxHeight={undefined}
          scrollOffset={scrollOffset}
          collapse={collapse}
        />

        {/* Partial compact selection mode */}
        {isPartialSelectMode && (
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
            <Text color="cyan" bold>Select pivot message for partial compact</Text>
            <Text color="gray">↑/k ↓/j navigate  [f] compact from here  [u] compact up to here  [Esc] cancel</Text>
            <Text color="gray">Selected: message {partialSelectedIndex + 1} of {history.displayMessages.length}</Text>
          </Box>
        )}

        {/* Compact status */}
        {isCompacting && (
          <Box paddingX={1}>
            <Text color="cyan">Compressing conversation…</Text>
          </Box>
        )}
        {lastCompactInfo && !isCompacting && (
          <Box paddingX={1}>
            <Text color="green" dimColor>
              Compacted — saved ~{lastCompactInfo.savedTokens.toLocaleString()} tokens
            </Text>
          </Box>
        )}
      </Box>

      {/* 工具权限确认 */}
      {permissionRequest && (
        <PermissionPrompt
          request={permissionRequest}
          selectedIndex={permSelectedIndex}
        />
      )}

      {askUserRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
          <Text color="magenta" bold>
            {askUserRequest.question}
          </Text>
          <Text> </Text>
          {askUserRequest.options.map((opt, i) => (
            <Box key={i}>
              <Text color={i === selectedIndex ? 'magenta' : 'gray'} bold={i === selectedIndex}>
                {i === selectedIndex ? '▶ ' : '  '}
                {opt.label}
              </Text>
              {opt.description && <Text color="gray"> — {opt.description}</Text>}
            </Box>
          ))}
          <Text> </Text>
          <Text color="gray" dimColor>
            ↑↓ navigate  Enter to select
          </Text>
        </Box>
      )}

      {planApprovalRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
          <Text color="blue" bold>Plan Review</Text>
          <Text> </Text>
          <Text>{planApprovalRequest.plan}</Text>
          <Text> </Text>
          {collectingPlanReason ? (
            <>
              <Text color="yellow">Reason for rejection:</Text>
              <PromptInput
                onSubmit={(reason) => planApprovalRequest.resolve(reason || 'rejected')}
                isLoading={false}
              />
            </>
          ) : (
            <Text>
              <Text color="green">y</Text> approve{'  '}
              <Text color="red">n</Text> reject{'  '}
              <Text color="yellow">r</Text> reject with reason
            </Text>
          )}
        </Box>
      )}

      {verifyRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Text color="cyan" bold>Verify Execution</Text>
          <Text> </Text>
          <Text>{verifyRequest.summary}</Text>
          <Text> </Text>
          {collectingVerifyReason ? (
            <>
              <Text color="yellow">Reason for rejection:</Text>
              <PromptInput
                onSubmit={(reason) => verifyRequest.resolve(reason || 'rejected')}
                isLoading={false}
              />
            </>
          ) : (
            <Text>
              <Text color="green">y</Text> verified{'  '}
              <Text color="red">n</Text> rejected{'  '}
              <Text color="yellow">r</Text> reject with reason
            </Text>
          )}
        </Box>
      )}

      {/* 加载中指示器 */}
      {isLoading && !permissionRequest && !askUserRequest && !planApprovalRequest && !verifyRequest && (
        <Spinner />
      )}

      {/* 输入区 — 固定在底部 */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="red"
        paddingX={1}
      >
        <PromptInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={
            !!permissionRequest ||
            !!askUserRequest ||
            !!planApprovalRequest ||
            !!verifyRequest ||
            isPartialSelectMode
          }
          onExit={doExit}
          onCancel={handleCancel}
          skills={skills}
        />
      </Box>
    </Box>
  )
}
