// src/constants/systemPromptSections.ts
// 分段注册 + 缓存机制 — 对标 Claude Code src/constants/systemPromptSections.ts

export type SectionContext = {
  cwd: string
  sessionId: string
  workspaceDir: string
  isPlanMode: boolean
}

type SectionLoader = (ctx: SectionContext) => Promise<string | null>

type SectionEntry = {
  id: string
  loader: SectionLoader
  volatile: boolean
  cached?: string | null // undefined = 未加载; null = 加载结果为空
}

// 按注册顺序排列，决定最终拼接顺序
const registry: SectionEntry[] = []

export function registerSection(id: string, loader: SectionLoader): void {
  registry.push({ id, loader, volatile: false })
}

export function registerVolatileSection(id: string, loader: SectionLoader): void {
  registry.push({ id, loader, volatile: true })
}

export async function resolveSystemPrompt(ctx: SectionContext): Promise<string> {
  const results = await Promise.all(
    registry.map(async (entry) => {
      // volatile 段每次重新执行
      if (entry.volatile) {
        return entry.loader(ctx)
      }
      // 普通段：已缓存则直接返回
      if (entry.cached !== undefined) {
        return entry.cached
      }
      // 首次加载并缓存
      const result = await entry.loader(ctx)
      entry.cached = result
      return result
    }),
  )

  return results
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .join('\n\n---\n\n')
}

export function clearSectionCache(): void {
  for (const entry of registry) {
    if (!entry.volatile) {
      entry.cached = undefined
    }
  }
}

// 重置注册表（仅供测试使用）
export function _resetRegistry(): void {
  registry.length = 0
}
