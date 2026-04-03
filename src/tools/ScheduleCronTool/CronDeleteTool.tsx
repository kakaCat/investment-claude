import React from 'react'
import { buildTool } from '../../Tool.js'
import { removeCronTask } from '../../cron/cronStore.js'
import { CRON_DELETE_DESCRIPTION, CRON_DELETE_SEARCH_HINT } from './prompt.js'
import { CronDeleteToolUseUI, CronDeleteToolResultUI } from './UI.js'

export const CronDeleteTool = buildTool({
  name: 'cron_delete',
  description: CRON_DELETE_DESCRIPTION,
  searchHint: CRON_DELETE_SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Job ID returned by cron_create.' },
    },
    required: ['id'],
  },
  renderToolUse: (input) => <CronDeleteToolUseUI input={input as { id: string }} />,
  renderToolResult: (result) => <CronDeleteToolResultUI result={result} />,
  async call(input) {
    const { id } = input as { id: string }
    const removed = removeCronTask(id)
    if (!removed) return `ERROR: No scheduled job with id '${id}'.`
    return `Cancelled job ${id}.`
  },
})
