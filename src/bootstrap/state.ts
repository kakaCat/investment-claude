// 全局会话状态 — 对标 Claude Code src/bootstrap/state.ts
// 注意：只存不可变的启动时信息，运行时变化的数据放 React state

import { homedir } from 'os'
import { join } from 'path'
import { getSessionId as generateSessionId } from '../tasks/sessionId.js'

export type State = {
  originalCwd: string   // 启动时的工作目录
  projectRoot: string   // 项目根目录（当前阶段与 originalCwd 相同）
  workDir: string       // 当前工作目录
  taskDir: string       // 任务存储目录 ~/.pi/tasks/
  sessionId: string
  workspaceDir: string  // .pi/sessions/{sessionId}/workspace/
}

const _sessionId = generateSessionId()

const state: State = {
  originalCwd: process.cwd(),
  projectRoot: process.cwd(),
  workDir: process.cwd(),
  taskDir: join(homedir(), '.pi', 'tasks'),
  sessionId: _sessionId,
  workspaceDir: join(process.cwd(), '.pi', 'sessions', _sessionId, 'workspace'),
}

export function getOriginalCwd(): string {
  return state.originalCwd
}

export function getProjectRoot(): string {
  return state.projectRoot
}

export function getWorkDir(): string {
  return state.workDir
}

export function getTaskDir(): string {
  return state.taskDir
}

export function getSessionId(): string {
  return state.sessionId
}

export function getWorkspaceDir(): string {
  return state.workspaceDir
}
