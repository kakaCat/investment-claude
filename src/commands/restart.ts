import { registerCommand } from './index.js'
import { performRestart } from '../utils/restart.js'

registerCommand({
  name: 'restart',
  aliases: ['reboot'],
  description: '🔄 重启 Agent 进程',
  async call(args, ctx) {
    const preserveContext = !args.includes('--clean')

    ctx.history.appendUserMessage(`/restart ${args}`)
    ctx.history.appendAssistantMessage(
      preserveContext
        ? '🔄 正在重启（保留上下文）...'
        : '🔄 正在重启（清空上下文）...'
    )

    await performRestart(preserveContext)
    return true
  }
})
