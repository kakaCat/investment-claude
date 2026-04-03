export type CronTask = {
  id: string
  cron: string
  prompt: string
  recurring: boolean
  createdAt: number
  lastFiredAt?: number
}
