import { registerCommand } from './index.js'
import { runDream } from '../dream/index.js'

registerCommand({
  name: 'dream',
  description: '💤 整理记忆 — 将对话中的重要信息写入长期记忆',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/dream')

    const controller = new AbortController()

    ctx.history.appendAssistantMessage('Dreaming... consolidating session memory into long-term memory.')

    try {
      const result = await runDream(
        process.cwd(),
        (msg) => ctx.history.appendAssistantMessage(msg),
        controller.signal,
      )

      if (result.skipped) {
        ctx.history.appendAssistantMessage(`Dream skipped: ${result.skipped}`)
      } else if (result.written.length === 0) {
        ctx.history.appendAssistantMessage('Dream complete. Nothing new to consolidate.')
      } else {
        ctx.history.appendAssistantMessage(
          `Dream complete. Wrote ${result.written.length} memory file(s):\n${result.written.map(f => `  - ${f}`).join('\n')}`,
        )
      }
    } catch (err) {
      ctx.history.appendAssistantMessage(
        `Dream failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    return true
  },
})
