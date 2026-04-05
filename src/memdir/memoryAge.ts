import type { MemoryTypeHandler } from './Memory.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getMemoryAge(mtimeMs: number): string {
  const now = Date.now()
  const diffDays = Math.floor((now - mtimeMs) / MS_PER_DAY)

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'

  return `${diffDays} 天前`
}

export function buildMemoryAgeWarning(
  mtimeMs: number,
  handler: MemoryTypeHandler,
): string | null {
  const now = Date.now()
  const diffDays = Math.floor((now - mtimeMs) / MS_PER_DAY)

  if (diffDays <= handler.ageWarningDays) return null

  return `⚠️ 此记忆最后更新于 ${diffDays} 天前，可能已过时（${handler.name} 类型建议 ${handler.ageWarningDays} 天内更新）`
}
