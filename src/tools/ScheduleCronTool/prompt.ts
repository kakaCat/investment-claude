export const CRON_CREATE_DESCRIPTION = `Schedule a prompt to be enqueued at a future time. Use for both recurring schedules and one-shot reminders.

Uses standard 5-field cron in local time: minute hour day-of-month month day-of-week. "0 9 * * *" means 9am local.

One-shot tasks (recurring: false): fire once then auto-delete.
Recurring tasks (recurring: true, the default): fire on every cron match. Auto-expire after 7 days.`

export const CRON_CREATE_SEARCH_HINT = 'schedule cron reminder recurring prompt timer'

export const CRON_DELETE_DESCRIPTION = `Cancel a cron job previously scheduled with cron_create. Pass the job ID returned by cron_create.`
export const CRON_DELETE_SEARCH_HINT = 'cron delete cancel remove job schedule'

export const CRON_LIST_DESCRIPTION = `List all active scheduled cron jobs in this session.`
export const CRON_LIST_SEARCH_HINT = 'cron list show jobs schedule'
