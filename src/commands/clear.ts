import { registerCommand } from './index.js'

registerCommand({
  name: 'clear',
  aliases: ['reset', 'new'],
  description: '🧹 清空对话 — 释放上下文空间，重新开始',
  async call(_args, ctx) {
    ctx.resetSession()
    return true
  },
})
