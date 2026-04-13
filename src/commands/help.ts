import { registerCommand, getRegistry } from './index.js'

registerCommand({
  name: 'help',
  description: 'Show available commands',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/help')
    const lines = getRegistry().map(cmd => {
      const names = [cmd.name, ...(cmd.aliases ?? [])].map(n => `/${n}`).join(', ')
      return `  ${names.padEnd(20)} — ${cmd.description}`
    })
    ctx.history.appendAssistantMessage(`Available commands:\n${lines.join('\n')}`)
    return true
  },
})
