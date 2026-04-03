import React from 'react'
import { buildTool } from '../../Tool.js'
import { listCronTasks } from '../../cron/cronStore.js'
import { cronToHuman } from '../../cron/cron.js'
import { CRON_LIST_DESCRIPTION, CRON_LIST_SEARCH_HINT } from './prompt.js'
import { CronListToolUseUI, CronListToolResultUI } from './UI.js'

export const CronListTool = buildTool({
  name: 'cron_list',
  description: CRON_LIST_DESCRIPTION,
  searchHint: CRON_LIST_SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  isReadOnly: () => true,
  renderToolUse: (_input) => <CronListToolUseUI />,
  renderToolResult: (result) => <CronListToolResultUI result={result} />,
  async call() {
    const tasks = listCronTasks()
    if (tasks.length === 0) return 'No scheduled jobs.'
    return tasks
      .map(t => {
        const human = cronToHuman(t.cron)
        const type = t.recurring ? '(recurring)' : '(one-shot)'
        const prompt = t.prompt.length > 80 ? t.prompt.slice(0, 80) + '…' : t.prompt
        return `${t.id} — ${human} ${type}: ${prompt}`
      })
      .join('\n')
  },
})
