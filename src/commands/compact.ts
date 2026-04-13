import { registerCommand } from './index.js'

registerCommand({
  name: 'compact',
  description: 'Compress conversation to save tokens. Optional: /compact [instructions]',
  async call(args, ctx) {
    // /compact partial — 进入部分压缩选择模式
    if (args.trim() === 'partial') {
      if (ctx.conversationRef.current.length < 2) {
        ctx.history.appendUserMessage('[System: Need at least 2 messages for partial compact]')
        return true
      }
      ctx.enterPartialCompact(Math.floor(ctx.conversationRef.current.length / 2))
      return true
    }

    ctx.history.appendUserMessage(args ? `/compact ${args}` : '/compact')
    await ctx.runCompact(ctx.sessionIdRef.current)
    return true
  },
})
