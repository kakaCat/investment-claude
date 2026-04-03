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
      return `ERROR: Invalid cron expression '${cron}'. Expected 5 fields: M H DoM Mon DoW.`
    }
    const nextRun = computeNextCronRun(fields, new Date())
    if (!nextRun) {
      return `ERROR: Cron expression '${cron}' does not match any date in the next year.`
    }
    if (listCronTasks().length >= MAX_JOBS) {
      return `ERROR: Too many scheduled jobs (max ${MAX_JOBS}). Cancel one first.`
    }
    const id = addCronTask(cron, prompt, recurring)
    const humanSchedule = cronToHuman(cron)
    const recurringNote = recurring
      ? `Recurring (auto-expires after 7 days). Use cron_delete to cancel sooner.`
      : `One-shot (fires once then auto-deletes).`
    return `Scheduled job ${id} (${humanSchedule}). Session-only. ${recurringNote}`
  },
})
