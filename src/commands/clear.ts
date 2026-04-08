import { registerCommand } from './index.js'

registerCommand({
  name: 'clear',
  aliases: ['reset', 'new'],
  description: 'Clear conversation history and free up context',
  async call(_args, ctx) {
    ctx.resetSession()
    return true
  },
})
