// src/memdir/types/user.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const userTypeHandler: MemoryTypeHandler = {
  name: 'user',
  description: 'Information about the user — role, goals, preferences, knowledge',
  defaultWeight: 3,
  ageWarningDays: 30,
  formatForInjection(memory: Memory): string {
    return `## [user] ${memory.name}\n\n${memory.content}`
  },
}
