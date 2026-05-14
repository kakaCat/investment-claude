import { registerCommand, getRegistry } from './index.js'

registerCommand({
  name: 'help',
  description: '❓ 显示所有可用命令',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/help')
    const lines = getRegistry().map(cmd => {
      const names = [cmd.name, ...(cmd.aliases ?? [])].map(n => `/${n}`).join(', ')
      return `  ${names.padEnd(20)} — ${cmd.description}`
    })
    ctx.history.appendAssistantMessage(`可用命令:\n${lines.join('\n')}`)
    return true
  },
})
