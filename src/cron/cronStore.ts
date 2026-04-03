import { randomUUID } from 'crypto'
import type { CronTask } from './types.js'

let tasks: CronTask[] = []

export function addCronTask(cron: string, prompt: string, recurring: boolean): string {
  const id = randomUUID().slice(0, 8)
  tasks.push({ id, cron, prompt, recurring, createdAt: Date.now() })
  return id
}

export function removeCronTask(id: string): boolean {
  const before = tasks.length
  tasks = tasks.filter(t => t.id !== id)
  return tasks.length < before
}

export function listCronTasks(): CronTask[] {
  return tasks
}

export function updateLastFired(id: string, firedAt: number): void {
  const t = tasks.find(t => t.id === id)
  if (t) t.lastFiredAt = firedAt
}
