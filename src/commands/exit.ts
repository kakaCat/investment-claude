import { registerCommand } from './index.js'

registerCommand({
  name: 'exit',
  aliases: ['quit'],
  description: '🚪 退出会话',
  async call(_args, ctx) {
    await ctx.doExit()
    return true
  },
})
