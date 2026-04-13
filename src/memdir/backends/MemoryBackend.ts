// src/memdir/backends/MemoryBackend.ts
import type { MemoryFileMeta } from '../Memory.js'

export interface MemoryBackend {
  name: string

  /** Returns metadata for all .md files in the memory directory */
  scanFiles(signal: AbortSignal): Promise<MemoryFileMeta[]>

  /** Reads full file content */
  readFile(filePath: string): Promise<string>

  /** Writes file content (creates directories as needed) */
  writeFile(filePath: string, content: string): Promise<void>

  /** Optional: semantic search. Returns null → fall back to keyword scoring */
  semanticSearch?(query: string, topK: number): Promise<MemoryFileMeta[] | null>
}
