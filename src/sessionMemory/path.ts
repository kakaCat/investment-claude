import { homedir } from 'os'
import { join } from 'path'

export function getSessionMemoryDir(): string {
  return join(homedir(), '.claude', 'session-memory')
}

export function getSessionMemoryPath(): string {
  return join(getSessionMemoryDir(), 'notes.md')
}
