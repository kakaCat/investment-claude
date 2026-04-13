// src/memdir/types/reference.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const referenceTypeHandler: MemoryTypeHandler = {
  name: 'reference',
  description: 'Pointers to external systems and resources',
  defaultWeight: 2,
  ageWarningDays: 180,
  formatForInjection(memory: Memory): string {
    return `## [reference] ${memory.name}\n\n${memory.content}`
  },
}
