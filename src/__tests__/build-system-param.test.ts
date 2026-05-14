// 测试 buildSystemParam 函数
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../constants/systemPromptSections.js'

// 模拟 buildSystemParam 函数（从 query.ts 中提取）
function buildSystemParam(
  systemPrompt: string,
): string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  const shouldUseGlobalCacheScope = process.env.USE_GLOBAL_CACHE_SCOPE === 'true'

  if (!shouldUseGlobalCacheScope) {
    return systemPrompt
  }

  const boundaryIndex = systemPrompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
  if (boundaryIndex === -1) {
    return systemPrompt
  }

  const staticPart = systemPrompt.slice(0, boundaryIndex).trim()
  const dynamicPart = systemPrompt.slice(boundaryIndex + SYSTEM_PROMPT_DYNAMIC_BOUNDARY.length).trim()

  const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = []

  if (staticPart) {
    blocks.push({
      type: 'text',
      text: staticPart,
      cache_control: { type: 'ephemeral' },
    })
  }

  if (dynamicPart) {
    blocks.push({
      type: 'text',
      text: dynamicPart,
    })
  }

  return blocks
}

describe('buildSystemParam', () => {
  beforeEach(() => {
    delete process.env.USE_GLOBAL_CACHE_SCOPE
  })

  afterEach(() => {
    delete process.env.USE_GLOBAL_CACHE_SCOPE
  })

  it('should return string when USE_GLOBAL_CACHE_SCOPE is false', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'false'
    const prompt = 'Static content\n\n' + SYSTEM_PROMPT_DYNAMIC_BOUNDARY + '\n\nDynamic content'
    const result = buildSystemParam(prompt)

    expect(typeof result).toBe('string')
    expect(result).toBe(prompt)
  })

  it('should return string when no boundary exists', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const prompt = 'Just a simple prompt without boundary'
    const result = buildSystemParam(prompt)

    expect(typeof result).toBe('string')
    expect(result).toBe(prompt)
  })

  it('should split into blocks with cache_control when boundary exists', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const staticContent = 'Static content here'
    const dynamicContent = 'Dynamic content here'
    const prompt = `${staticContent}\n\n${SYSTEM_PROMPT_DYNAMIC_BOUNDARY}\n\n${dynamicContent}`

    const result = buildSystemParam(prompt)

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(2)

      // 第一个 block 是静态内容，带 cache_control
      expect(result[0]).toEqual({
        type: 'text',
        text: staticContent,
        cache_control: { type: 'ephemeral' },
      })

      // 第二个 block 是动态内容，不带 cache_control
      expect(result[1]).toEqual({
        type: 'text',
        text: dynamicContent,
      })
    }
  })

  it('should handle only static content', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const staticContent = 'Only static content'
    const prompt = `${staticContent}\n\n${SYSTEM_PROMPT_DYNAMIC_BOUNDARY}\n\n`

    const result = buildSystemParam(prompt)

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'text',
        text: staticContent,
        cache_control: { type: 'ephemeral' },
      })
    }
  })

  it('should handle only dynamic content', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const dynamicContent = 'Only dynamic content'
    const prompt = `\n\n${SYSTEM_PROMPT_DYNAMIC_BOUNDARY}\n\n${dynamicContent}`

    const result = buildSystemParam(prompt)

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'text',
        text: dynamicContent,
      })
    }
  })

  it('should trim whitespace from both parts', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const prompt = `  \n  Static  \n  \n${SYSTEM_PROMPT_DYNAMIC_BOUNDARY}\n  \n  Dynamic  \n  `

    const result = buildSystemParam(prompt)

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result[0]?.text).toBe('Static')
      expect(result[1]?.text).toBe('Dynamic')
    }
  })

  it('should handle multiline content correctly', () => {
    process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
    const staticContent = 'Line 1\nLine 2\nLine 3'
    const dynamicContent = 'Dynamic 1\nDynamic 2'
    const prompt = `${staticContent}\n\n${SYSTEM_PROMPT_DYNAMIC_BOUNDARY}\n\n${dynamicContent}`

    const result = buildSystemParam(prompt)

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result[0]?.text).toBe(staticContent)
      expect(result[1]?.text).toBe(dynamicContent)
    }
  })
})
