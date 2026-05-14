// 测试 prompt caching 功能
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  shouldUseGlobalCacheScope,
  resolveSystemPrompt,
  clearSectionCache,
  _resetRegistry,
  registerSection,
  registerVolatileSection,
  type SectionContext,
} from '../constants/systemPromptSections.js'

describe('Prompt Caching', () => {
  const mockContext: SectionContext = {
    cwd: '/test',
    sessionId: 'test-session',
    workspaceDir: '/test',
    isPlanMode: false,
  }

  beforeEach(() => {
    _resetRegistry()
    delete process.env.USE_GLOBAL_CACHE_SCOPE
  })

  afterEach(() => {
    clearSectionCache()
    delete process.env.USE_GLOBAL_CACHE_SCOPE
  })

  describe('shouldUseGlobalCacheScope', () => {
    it('should return false by default', () => {
      expect(shouldUseGlobalCacheScope()).toBe(false)
    })

    it('should return true when USE_GLOBAL_CACHE_SCOPE=true', () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'true'
      expect(shouldUseGlobalCacheScope()).toBe(true)
    })

    it('should return false when USE_GLOBAL_CACHE_SCOPE=false', () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'false'
      expect(shouldUseGlobalCacheScope()).toBe(false)
    })
  })

  describe('SYSTEM_PROMPT_DYNAMIC_BOUNDARY', () => {
    it('should be a non-empty string', () => {
      expect(SYSTEM_PROMPT_DYNAMIC_BOUNDARY).toBeTruthy()
      expect(typeof SYSTEM_PROMPT_DYNAMIC_BOUNDARY).toBe('string')
    })
  })

  describe('resolveSystemPrompt with boundary', () => {
    it('should not insert boundary when USE_GLOBAL_CACHE_SCOPE is false', async () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'false'

      registerSection('static1', async () => 'Static content 1')
      registerSection('static2', async () => 'Static content 2')
      registerVolatileSection('dynamic1', async () => 'Dynamic content 1')

      const result = await resolveSystemPrompt(mockContext)

      expect(result).not.toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      expect(result).toContain('Static content 1')
      expect(result).toContain('Static content 2')
      expect(result).toContain('Dynamic content 1')
    })

    it('should insert boundary between static and volatile sections when enabled', async () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'true'

      registerSection('static1', async () => 'Static content 1')
      registerSection('static2', async () => 'Static content 2')
      registerVolatileSection('dynamic1', async () => 'Dynamic content 1')
      registerVolatileSection('dynamic2', async () => 'Dynamic content 2')

      const result = await resolveSystemPrompt(mockContext)

      expect(result).toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)

      // 验证边界标记的位置
      const parts = result.split(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      expect(parts).toHaveLength(2)

      // 静态部分应该在边界之前
      expect(parts[0]).toContain('Static content 1')
      expect(parts[0]).toContain('Static content 2')

      // 动态部分应该在边界之后
      expect(parts[1]).toContain('Dynamic content 1')
      expect(parts[1]).toContain('Dynamic content 2')
    })

    it('should handle null sections correctly', async () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'true'

      registerSection('static1', async () => 'Static content')
      registerSection('static2', async () => null) // 返回 null
      registerVolatileSection('dynamic1', async () => 'Dynamic content')

      const result = await resolveSystemPrompt(mockContext)

      expect(result).toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      expect(result).toContain('Static content')
      expect(result).toContain('Dynamic content')
      expect(result).not.toContain('null')
    })

    it('should not insert boundary if no volatile sections exist', async () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'true'

      registerSection('static1', async () => 'Static content 1')
      registerSection('static2', async () => 'Static content 2')

      const result = await resolveSystemPrompt(mockContext)

      expect(result).not.toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      expect(result).toContain('Static content 1')
      expect(result).toContain('Static content 2')
    })

    it('should handle mixed order of sections', async () => {
      process.env.USE_GLOBAL_CACHE_SCOPE = 'true'

      registerSection('static1', async () => 'Static 1')
      registerVolatileSection('dynamic1', async () => 'Dynamic 1')
      registerSection('static2', async () => 'Static 2')
      registerVolatileSection('dynamic2', async () => 'Dynamic 2')

      const result = await resolveSystemPrompt(mockContext)

      // 边界应该在第一个 volatile section 之前
      expect(result).toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)

      const boundaryIndex = result.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      const static1Index = result.indexOf('Static 1')
      const dynamic1Index = result.indexOf('Dynamic 1')

      expect(static1Index).toBeLessThan(boundaryIndex)
      expect(boundaryIndex).toBeLessThan(dynamic1Index)
    })
  })
})
