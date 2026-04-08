import { registerCommand } from './index.js'

registerCommand({
  name: 'exit',
  aliases: ['quit'],
  description: 'Exit the session',
  async call(_args, ctx) {
    await ctx.doExit()
    return true
  },
})
