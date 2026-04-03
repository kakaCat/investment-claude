// src/state/todoReminder.ts
// 对标 Claude Code src/utils/attachments.ts getTodoReminderAttachments()
// 在 query loop 中每轮工具调用后检查是否需要向模型注入 todo 提醒。

import type { Message, UserMessage } from '../types/message.js'
import type { TodoItem } from '../tasks/types.js'

/**
 * 最近一次 todo_write 调用距今的 assistant 轮数阈值。
 * 超过此值时注入提醒，让模型在上下文压缩后也能感知当前 todo 状态。
 * 对标 Claude Code TODO_REMINDER_CONFIG.TURNS_SINCE_WRITE = 10
 */
const TURNS_SINCE_WRITE = 10

/**
 * 扫描消息历史，计算最近一次 todo_write 调用距今经过了多少个 assistant 轮次。
 * 注意：只数 assistant 轮，不数 user/tool_result 轮 —— 防止工具密集的轮次
 * 把计数打得太快（对标 Claude Code 的注释：count HUMAN turns, not assistant messages）。
 */
function turnsSinceLastTodoWrite(messages: Message[]): number {
  let count = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.type !== 'assistant') continue
    const hasTodoWrite = msg.content.some(
      (c) => c.type === 'tool_use' && c.name === 'todo_write',
    )
    if (hasTodoWrite) return count
    count++
  }
  // todo_write 从未被调用过 — 返回一个大值，触发注入
  return Number.MAX_SAFE_INTEGER
}

/**
 * 如果距上次 todo_write 已超过阈值轮次，返回一条包含当前 todos 的 UserMessage
 * 用于注入进 query 的 currentMessages，让模型重新感知任务状态。
 *
 * 返回 null 表示不需要注入。
 */
export function buildTodoReminderIfNeeded(
  messages: Message[],
  todos: readonly TodoItem[],
): UserMessage | null {
  if (todos.length === 0) return null
  if (turnsSinceLastTodoWrite(messages) < TURNS_SINCE_WRITE) return null

  return {
    type: 'user',
    content: [
      {
        type: 'text',
        text: `<system-reminder>\nThe TodoWrite tool hasn't been used recently. If you're working on tasks that would benefit from tracking progress, consider using the TodoWrite tool to track progress. Also consider cleaning up the todo list if has become stale and no longer matches what you are working on. Only use it if it's relevant to the current work. This is just a gentle reminder - ignore if not applicable. Make sure that you NEVER mention this reminder to the user\n\nCurrent todos:\n${JSON.stringify(todos, null, 2)}\n</system-reminder>`,
      },
    ],
  }
}
