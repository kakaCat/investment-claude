// src/memdir/types/project.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const projectTypeHandler: MemoryTypeHandler = {
  name: 'project',
  description: 'Ongoing work context — goals, decisions, deadlines, bugs',
  defaultWeight: 5,
  ageWarningDays: 7,
  formatForInjection(memory: Memory): string {
    return `## [project] ${memory.name}\n\n${memory.content}`
  },
}
