// src/memdir/types/feedback.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const feedbackTypeHandler: MemoryTypeHandler = {
  name: 'feedback',
  description: 'Guidance from the user about how to approach work — corrections and confirmations',
  defaultWeight: 4,
  ageWarningDays: 90,
  formatForInjection(memory: Memory): string {
    return `## [feedback] ${memory.name}\n\n${memory.content}`
  },
}
