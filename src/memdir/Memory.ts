// src/memdir/Memory.ts

/** Frontmatter-parsed metadata (no content, used for scan/search) */
export interface MemoryFileMeta {
  filePath: string
  name: string
  description: string
  /** Leaf type name only, e.g. "中学数学" — registry resolves tree position */
  type: string
  searchHint?: string
  /** File mtime in ms */
  mtimeMs: number
}

/** Full memory object including content and type handler */
export interface Memory extends MemoryFileMeta {
  content: string
  handler: MemoryTypeHandler
}

export interface MemoryTypeHandler {
  name: string
  description: string
  /** Base weight for keyword scoring in MemorySearchTool */
  defaultWeight: number
  /** Days before staleness warning is added to search results */
  ageWarningDays: number
  formatForInjection(memory: Memory): string
}

export interface CustomTypeDefinition {
  name: string
  parent: string | null
  description: string
  defaultWeight?: number
  ageWarningDays?: number
  searchHint?: string
}
