import { registerCommand } from './index.js'
import { getLogFilePath, getHtmlFilePath } from '../observability/logger.js'
import { generateReport } from '../observability/htmlReport.js'

registerCommand({
  name: 'report',
  description: '📄 生成 HTML 报告 — 导出当前会话日志',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/report')
    const jsonlPath = getLogFilePath()
    const htmlPath = getHtmlFilePath()
    if (!jsonlPath || !htmlPath) {
      ctx.history.appendAssistantMessage('No session log found.')
      return true
    }
    try {
      await generateReport(jsonlPath, htmlPath)
      ctx.history.appendAssistantMessage(`Report generated: ${htmlPath}`)
    } catch {
      ctx.history.appendAssistantMessage('Failed to generate report.')
    }
    return true
  },
})
