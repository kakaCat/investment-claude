// 主屏幕 — 简化版，对标 Claude Code src/screens/REPL.tsx
// 目标 ≤300 行。职责：驱动 query 循环，处理 StreamEvent，协调 UI

import { randomUUID } from 'crypto'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { query, type CanUseTool } from '../query.js'
import { getSystemPrompt, initSystemPrompt, clearSectionCache, type SectionContext } from '../constants/prompts.js'
import { executeHooks } from '../hooks/index.js'
import { useMergedTools } from '../hooks/useMergedTools.js'
import { getAllTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'
import { useAssistantHistory } from '../hooks/useAssistantHistory.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { Spinner } from '../components/Spinner.js'
import type { SSHSession } from '../ssh/index.js'
import type { SwarmConfig } from '../swarm/index.js'
import type { ToolUseContext } from '../Tool.js'
import type { Message } from '../types/message.js'
import { createCronScheduler } from '../cron/cronScheduler.js'
import { compactConversation, partialCompactConversation } from '../compact/index.js'
import { initSessionMemory } from '../sessionMemory/index.js'
import { getWorkDir, getSessionId, getWorkspaceDir } from '../bootstrap/state.js'

type Props = {
  // Stub props — 接口预留，当前不使用
  sshSession?: SSHSession
  swarmConfig?: SwarmConfig
}

type PermissionRequest = {
  toolName: string
  input: unknown
  resolve: (decision: 'allow' | 'deny') => void
}

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

export function REPL(_props: Props) {
  // 初始化系统提示词注册表（只执行一次）
  initSystemPrompt()

  const tools = useMergedTools()
  const allTools = useMemo(() => getAllTools(getPluginTools()), [])
  const history = useAssistantHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPlanMode, setIsPlanMode] = useState(false)
  const [planApprovalRequest, setPlanApprovalRequest] = useState<PlanApprovalRequest | null>(null)
  const [collectingPlanReason, setCollectingPlanReason] = useState(false)
  const [verifyRequest, setVerifyRequest] = useState<VerifyRequest | null>(null)
  const [collectingVerifyReason, setCollectingVerifyReason] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)
  const [lastCompactInfo, setLastCompactInfo] = useState<{ savedTokens: number } | null>(null)
  const [isPartialSelectMode, setIsPartialSelectMode] = useState(false)
  const [partialSelectedIndex, setPartialSelectedIndex] = useState(0)
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

  // ── canUseTool 回调（传给 query()，在工具执行前弹出确认 UI）─────────────────
  // 对标 Claude Code canUseTool / wrappedCanUseTool
  const canUseTool = useCallback<CanUseTool>(
    (name, _input) => {
      if (isPlanModeRef.current && WRITE_TOOLS.has(name)) {
        return Promise.resolve('deny')
      }
      return Promise.resolve('allow')
    },
    [],
  )

  const askUser = useCallback<NonNullable<ToolUseContext['askUser']>>(
    (question, options) =>
      new Promise((resolve) => {
        setSelectedIndex(0)
        setAskUserRequest({ question, options, resolve })
      }),
    [],
  )

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
  const handleSubmit = useCallback(
    async (input: string) => {
      // ── slash commands ──────────────────────────────────────────────────
      if (input === '/clear') {
        void executeHooks({
          hook_event_name: 'SessionEnd',
          exit_reason: 'clear',
          session_id: sessionIdRef.current,
          cwd: process.cwd(),
        })
        sessionIdRef.current = randomUUID()
        void executeHooks({
          hook_event_name: 'SessionStart',
          source: 'clear',
          session_id: sessionIdRef.current,
          cwd: process.cwd(),
        })
        clearSectionCache()
        history.clearMessages()
        conversationRef.current = []
        return
      }
      if (input === '/help') {
        history.appendUserMessage('/help')
        history.startAssistantMessage()
        history.appendStreamingDelta(
          'Available commands:\n  /help    — show this message\n  /clear   — clear the conversation\n  /compact — compress conversation to save tokens',
        )
        history.finalizeAssistantMessage()
        return
      }

      if (input === '/compact') {
        history.appendUserMessage('/compact')
        setIsLoading(true)
        isLoadingRef.current = true
        history.startAssistantMessage()
        try {
          const result = await compactConversation(history.messages, {
            suppressFollowUpQuestions: false,
            sessionId: sessionIdRef.current,
          })
          history.replaceMessages(result.newMessages)
          history.finalizeAssistantMessage()
          history.appendUserMessage(
            `[System: Conversation compacted. Saved ~${result.savedTokens.toLocaleString()} tokens]`,
          )
        } catch (err) {
          history.finalizeAssistantMessage()
          history.appendUserMessage(
            `[System: Compact failed — ${err instanceof Error ? err.message : String(err)}]`,
          )
        } finally {
          setIsLoading(false)
          isLoadingRef.current = false
        }
        return
      }

      if (input === '/compact partial') {
          if (history.messages.length < 2) {
            history.appendUserMessage('[System: Need at least 2 messages for partial compact]')
            return
          }
          setPartialSelectedIndex(Math.floor(history.messages.length / 2))
          setIsPartialSelectMode(true)
          return
        }

      await executeHooks({
        hook_event_name: 'UserPromptSubmit',
        prompt: input,
        session_id: sessionIdRef.current,
        cwd: process.cwd(),
      })

      history.appendUserMessage(input)
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
          { type: 'user' as const, content: [{ type: 'text' as const, text: input }] },
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
          abortSignal: abortController.signal,
          sessionId: sessionIdRef.current,
        })

        for await (const event of gen) {
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
              break

            case 'max_turns_reached':
              history.finalizeAssistantMessage()
              history.appendUserMessage(`[System: reached ${event.turnCount} turn limit]`)
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
              history.replaceMessages(event.newMessages)
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
              setPermissionRequest(null)
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
    [tools, history, canUseTool, askUser, enterPlanMode, exitPlanMode, verifyExecution],
  )

  // Keep ref in sync with latest handleSubmit (stale-closure-safe for cron scheduler)
  handleSubmitRef.current = handleSubmit

  useEffect(() => {
    if (!smInitializedRef.current) {
      smInitializedRef.current = true
      initSessionMemory()
    }

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
                  history.messages,
                  partialSelectedIndex,
                  'from',
                  { sessionId: sessionIdRef.current },
                )
                history.replaceMessages(result.newMessages)
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
                  history.messages,
                  partialSelectedIndex,
                  'up_to',
                  { sessionId: sessionIdRef.current },
                )
                history.replaceMessages(result.newMessages)
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

      // 权限确认
      if (permissionRequest) {
        if (input === 'y' || key.return) {
          permissionRequest.resolve('allow')
        } else if (input === 'n' || key.escape) {
          permissionRequest.resolve('deny')
        }
        return
      }

      // Ctrl+C 中止当前 query（对标 Claude Code interrupt()）
      if (key.ctrl && input === 'c' && isLoading) {
        abortControllerRef.current?.abort()
      }
    },
    { isActive: true },
  )

  return (
    <Box flexDirection="column" padding={1}>
      {/* 消息历史 */}
      <Messages
        messages={history.displayMessages}
        tools={tools}
      />

      {/* 计划模式状态栏 */}
      {isPlanMode && (
        <Box paddingX={1}>
          <Text color="blue" bold>[PLAN MODE] </Text>
          <Text color="gray">Write tools disabled — call exit_plan_mode when ready</Text>
        </Box>
      )}

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

      {/* 工具权限确认 */}
      {permissionRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>
            Allow tool use?
          </Text>
          <Text>
            Tool: <Text color="cyan">{permissionRequest.toolName}</Text>
          </Text>
          <Text>
            Input: <Text color="gray">{JSON.stringify(permissionRequest.input)}</Text>
          </Text>
          <Text>
            <Text color="green">y</Text> to allow, <Text color="red">n</Text> to deny
          </Text>
        </Box>
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

      {/* 加载中 */}
      {isLoading && !permissionRequest && !askUserRequest && !planApprovalRequest && !verifyRequest && <Spinner />}

      {/* 输入框 */}
      {!isLoading && !askUserRequest && !planApprovalRequest && !verifyRequest && <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />}
    </Box>
  )
}
