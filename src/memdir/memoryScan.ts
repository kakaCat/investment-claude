import type { MemoryFileMeta } from './Memory.js'

export function scoreMemoryForQuery(
  meta: MemoryFileMeta,
  terms: string[],
  defaultWeight: number,
): number {
  const name = meta.name.toLowerCase()
  const hint = (meta.searchHint ?? '').toLowerCase()
  const desc = meta.description.toLowerCase()
  let score = 0

  for (const term of terms) {
    if (name === term) {
      score += 10 + defaultWeight
    } else if (name.includes(term)) {
      score += 5 + defaultWeight
    } else if (hint.split(/\W+/).includes(term)) {
      score += 4 + defaultWeight
    } else if (hint.includes(term)) {
      score += 2 + defaultWeight
    } else if (desc.split(/\W+/).includes(term)) {
      score += 2 + defaultWeight
    } else if (desc.includes(term)) {
      score += 1 + defaultWeight
    }
  }

  return score
}

export function formatMemoryManifest(metas: MemoryFileMeta[]): string {
  if (metas.length === 0) return 'No memories found.'

  return metas
    .map((m) => `- **${m.name}** [${m.type}]: ${m.description} — \`${m.filePath}\``)
    .join('\n')
}
