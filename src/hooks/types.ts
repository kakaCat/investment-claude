// Hook 框架类型系统 — 对标 Claude Code 的 hooks event/settings/result 类型
// 仅包含共享类型声明与事件常量，供 Hook 注册、匹配、执行与结果聚合使用。

import type { Message } from '../types/message.js'

export const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'StopFailure',
  'UserPromptSubmit',
  'SessionStart', 'SessionEnd',
  'Notification',
  'PreCompact', 'PostCompact',
  'SubagentStart', 'SubagentStop',
  'TeammateIdle',
  'TaskCreated', 'TaskCompleted',
  'PermissionRequest', 'PermissionDenied',
  'Setup',
  'Elicitation', 'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate', 'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged', 'FileChanged',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

export type BaseHookInput<TEvent extends HookEvent = HookEvent> = {
  hook_event_name: TEvent
  session_id: string
  cwd: string
}

type ToolHookFields = {
  tool_name: string
  tool_input: unknown
}

type TaskHookFields = {
  task_id: string
  content: string
}

type CompactTrigger = 'auto' | 'manual' | 'partial'

export type PreToolUseHookInput = BaseHookInput<'PreToolUse'> & ToolHookFields

export type PostToolUseHookInput = BaseHookInput<'PostToolUse'> & ToolHookFields & {
  tool_response: string
}

export type PostToolUseFailureHookInput = BaseHookInput<'PostToolUseFailure'> & ToolHookFields & {
  tool_error: string
}

export type StopHookInput = BaseHookInput<'Stop'> & {
  stop_reason: 'done' | 'max_turns_reached'
  messages?: Message[]
}

export type StopFailureHookInput = BaseHookInput<'StopFailure'> & {
  error: string
}

export type UserPromptSubmitHookInput = BaseHookInput<'UserPromptSubmit'> & {
  prompt: string
}

export type SessionStartHookInput = BaseHookInput<'SessionStart'> & {
  source: 'startup' | 'resume' | 'clear'
}

export type SessionEndHookInput = BaseHookInput<'SessionEnd'> & {
  exit_reason?: string
}

export type NotificationHookInput = BaseHookInput<'Notification'> & {
  message: string
}

export type PreCompactHookInput = BaseHookInput<'PreCompact'> & {
  trigger: CompactTrigger
}

export type PostCompactHookInput = BaseHookInput<'PostCompact'> & {
  trigger: CompactTrigger
  saved_tokens: number
}

export type SubagentStartHookInput = BaseHookInput<'SubagentStart'> & {
  agent_id: string
}

export type SubagentStopHookInput = BaseHookInput<'SubagentStop'> & {
  agent_id: string
}

export type TeammateIdleHookInput = BaseHookInput<'TeammateIdle'> & {
  teammate_name: string
}

export type TaskCreatedHookInput = BaseHookInput<'TaskCreated'> & TaskHookFields

export type TaskCompletedHookInput = BaseHookInput<'TaskCompleted'> & TaskHookFields

export type PermissionRequestHookInput = BaseHookInput<'PermissionRequest'> & ToolHookFields

export type PermissionDeniedHookInput = BaseHookInput<'PermissionDenied'> & ToolHookFields

export type SetupHookInput = BaseHookInput<'Setup'>

export type ElicitationHookInput = BaseHookInput<'Elicitation'> & {
  message: string
}

export type ElicitationResultHookInput = BaseHookInput<'ElicitationResult'> & {
  result: unknown
}

export type ConfigChangeHookInput = BaseHookInput<'ConfigChange'> & {
  config_path: string
}

export type WorktreeCreateHookInput = BaseHookInput<'WorktreeCreate'> & {
  worktree_path: string
  branch: string
}

export type WorktreeRemoveHookInput = BaseHookInput<'WorktreeRemove'> & {
  worktree_path: string
}

export type InstructionsLoadedHookInput = BaseHookInput<'InstructionsLoaded'> & {
  file_path: string
  content_length: number
}

export type CwdChangedHookInput = BaseHookInput<'CwdChanged'> & {
  old_cwd: string
  new_cwd: string
}

export type FileChangedHookInput = BaseHookInput<'FileChanged'> & {
  file_path: string
}

export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | StopHookInput
  | StopFailureHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | NotificationHookInput
  | PreCompactHookInput
  | PostCompactHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | TeammateIdleHookInput
  | TaskCreatedHookInput
  | TaskCompletedHookInput
  | PermissionRequestHookInput
  | PermissionDeniedHookInput
  | SetupHookInput
  | ElicitationHookInput
  | ElicitationResultHookInput
  | ConfigChangeHookInput
  | WorktreeCreateHookInput
  | WorktreeRemoveHookInput
  | InstructionsLoadedHookInput
  | CwdChangedHookInput
  | FileChangedHookInput

export type CommandHook = {
  type: 'command'
  command: string
  timeout?: number
  async?: boolean
}

export type FunctionHook = {
  type: 'function'
  id?: string
  callback: (input: HookInput) => Promise<void> | void
  timeout?: number
}

export type PromptHook = {
  type: 'prompt'
  prompt: string
  model?: string
}

export type HttpHook = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type HookCommand = CommandHook | FunctionHook | PromptHook | HttpHook

export type HookMatcher = {
  /** 工具名匹配 pattern（字符串前缀匹配）。缺省或空字符串表示匹配所有。*/
  matcher?: string
  hooks: HookCommand[]
}

export type HooksSettings = Partial<Record<HookEvent, HookMatcher[]>>

export type HookResult = {
  outcome: 'success' | 'blocking' | 'nonBlockingError' | 'cancelled'
  permissionDecision?: 'allow' | 'deny' | 'ask'
  updatedInput?: Record<string, unknown>
  preventContinuation?: boolean
  stopReason?: string
  additionalContext?: string
  systemMessage?: string
  initialUserMessage?: string
  watchPaths?: string[]
}

export type AggregatedHookResult = {
  permissionDecision?: 'allow' | 'deny' | 'ask'
  updatedInput?: Record<string, unknown>
  preventContinuation?: boolean
  stopReason?: string
  additionalContexts?: string[]
  systemMessage?: string
  initialUserMessage?: string
  watchPaths?: string[]
}
