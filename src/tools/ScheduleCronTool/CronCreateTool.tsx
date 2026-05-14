import React from 'react'
import { buildTool } from '../../Tool.js'
import { addCronTask, listCronTasks } from '../../cron/cronStore.js'
import { parseCronExpression, computeNextCronRun, cronToHuman } from '../../cron/cron.js'
import { CRON_CREATE_DESCRIPTION, CRON_CREATE_SEARCH_HINT } from './prompt.js'
import { CronCreateToolUseUI, CronCreateToolResultUI } from './UI.js'

const MAX_JOBS = 50

export const CronCreateTool = buildTool({
  name: 'cron_create',
  description: CRON_CREATE_DESCRIPTION,
  searchHint: CRON_CREATE_SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      cron: { type: 'string', description: 'Standard 5-field cron expression in local time: "M H DoM Mon DoW"' },
      prompt: { type: 'string', description: 'The prompt to enqueue at each fire time.' },
      recurring: { type: 'boolean', description: 'true (default) = recurring until deleted or 7-day auto-expire. false = fire once then delete.' },
    },
    required: ['cron', 'prompt'],
  },
  renderToolUse: (input) => <CronCreateToolUseUI input={input as { cron: string; prompt: string; recurring?: boolean }} />,
  renderToolResult: (result) => <CronCreateToolResultUI result={result} />,
  async call(input) {
    const { cron, prompt, recurring = true } = input as { cron: string; prompt: string; recurring?: boolean }
    const fields = parseCronExpression(cron)
    if (!fields) {
      return { data: `ERROR: Invalid cron expression '${cron}'. Expected 5 fields: M H DoM Mon DoW.` }
    }
    const nextRun = computeNextCronRun(fields, new Date())
    if (!nextRun) {
      return { data: `ERROR: Cron expression '${cron}' does not match any date in the next year.` }
    }
    if (listCronTasks().length >= MAX_JOBS) {
      return { data: `ERROR: Too many scheduled jobs (max ${MAX_JOBS}). Cancel one first.` }
    }
    const id = addCronTask(cron, prompt, recurring)
    const humanSchedule = cronToHuman(cron)
    const recurringNote = recurring
      ? `Recurring (auto-expires after 7 days). Use cron_delete to cancel sooner.`
      : `One-shot (fires once then auto-deletes).`
    return { data: `Scheduled job ${id} (${humanSchedule}). Session-only. ${recurringNote}` }
  },
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (output.startsWith('ERROR:')) {
      let errorMsg = `<error>${output}</error>\n\n`

      if (output.includes('Invalid cron expression')) {
        errorMsg += `Cron format: "minute hour day-of-month month day-of-week"\nExample: "0 9 * * 1-5" = weekdays at 9am\nExample: "*/15 * * * *" = every 15 minutes`
      } else if (output.includes('does not match any date')) {
        errorMsg += `The cron expression is valid but doesn't match any date in the next year. Check your day-of-month and month values.`
      } else if (output.includes('Too many scheduled jobs')) {
        errorMsg += `Use cron_list to see all jobs, then cron_delete to remove unused ones.`
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: errorMsg,
        is_error: true,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `${output}\n\nThe scheduled task will execute automatically at the specified time(s). Use cron_list to view all scheduled jobs.`,
    }
  },
})
