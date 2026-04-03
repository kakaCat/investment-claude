// STUB: 未实现 — 自动 compact
// 对标 Claude Code src/services/compact/
// 功能：当对话过长时自动压缩历史消息，释放 token 空间

import type { Message } from '../types/message.js'

export async function maybeCompact(messages: Message[]): Promise<Message[]> {
  // TODO: 实现自动压缩逻辑
  return messages
}
