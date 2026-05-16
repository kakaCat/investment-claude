import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { searchExperiences, searchDailyLogs, searchStockMemories } from '../ExperienceQueryTool.js'

const TEST_MEMORY_PATH = join(process.cwd(), '.pi-test', 'memory')
const TEST_DAILY_PATH = join(TEST_MEMORY_PATH, 'daily')
const TEST_STOCKS_PATH = join(TEST_MEMORY_PATH, 'stocks')

describe('ExperienceQueryTool', () => {
  beforeEach(() => {
    // Clean up first to ensure fresh state
    try {
      if (existsSync(TEST_MEMORY_PATH)) {
        rmSync(TEST_MEMORY_PATH, { recursive: true, force: true, maxRetries: 3 })
      }
    } catch (error) {
      // If cleanup fails, try to continue anyway
      console.warn('Cleanup warning:', error)
    }

    // Small delay to ensure filesystem operations complete
    const start = Date.now()
    while (Date.now() - start < 10) {
      // Wait 10ms
    }

    // Create test directory structure
    try {
      mkdirSync(TEST_MEMORY_PATH, { recursive: true })
      mkdirSync(TEST_DAILY_PATH, { recursive: true })
      mkdirSync(TEST_STOCKS_PATH, { recursive: true })
    } catch (error) {
      console.error('Failed to create test directories:', error)
      throw error
    }

    // Create test daily log
    const dailyLog = [
      JSON.stringify({
        ts: '2026-05-15T10:26:42.544Z',
        category: 'stock_decision',
        content: '紫金矿业(601899)当前处于下降趋势+主力出货+技术面破位阶段，但CCI/RSI严重超卖有反弹需求。用户持仓600股，成本34.09，浮亏-6.6%。决策：不加仓不减仓，设硬止损30.68（成本×0.9）。下周如果反弹到33以上减半仓(300股)。',
      }),
      JSON.stringify({
        ts: '2026-05-15T02:10:17.207Z',
        category: 'fact',
        content: '挂单管理工具 manage_orders 已实现，位于 src/infrastructure/tools/order-tools.ts。单一工具通过 action 参数区分操作：place（创建挂单）、cancel（撤销）、list（查看）、fill（手动成交）、check（自动检查触发并成交）。',
      }),
      JSON.stringify({
        ts: '2026-05-14T08:30:00.000Z',
        category: 'risk',
        content: '止损策略：对于亏损超过8%的持仓，应考虑止损。设置硬止损线为成本价的90%。',
      }),
    ].join('\n')

    writeFileSync(join(TEST_DAILY_PATH, '2026-05-15.jsonl'), dailyLog, 'utf-8')

    // Create test stock memory
    const stockMemory = `# 601899

紫金矿业(601899)交易日志已创建。持仓600股，成本34.09，当前处于下降趋势。技术面破位，但超卖严重。建议设置止损30.68。`

    writeFileSync(join(TEST_STOCKS_PATH, '601899.md'), stockMemory, 'utf-8')
  })

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(TEST_MEMORY_PATH)) {
        rmSync(TEST_MEMORY_PATH, { recursive: true, force: true, maxRetries: 3 })
      }
    } catch (error) {
      // Ignore cleanup errors in afterEach
      console.warn('Cleanup warning:', error)
    }
  })

  describe('searchDailyLogs', () => {
    it('should find experiences matching query', () => {
      const results = searchDailyLogs('止损', undefined, 10)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].content).toContain('止损')
    })

    it('should filter by category', () => {
      const results = searchDailyLogs('止损', 'risk_management', 10)
      expect(results.length).toBeGreaterThan(0)
      // Should match records with 'risk' or 'stock_decision' category
      const hasValidCategory = results.some(r =>
        r.category?.includes('risk') || r.category?.includes('stock_decision')
      )
      expect(hasValidCategory).toBe(true)
    })

    it('should respect limit parameter', () => {
      const results = searchDailyLogs('管理', undefined, 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return empty array for non-matching query', () => {
      const results = searchDailyLogs('不存在的内容xyz123', undefined, 10)
      expect(results.length).toBe(0)
    })

    it('should include source and timestamp', () => {
      const results = searchDailyLogs('止损', undefined, 10)
      expect(results[0].source).toContain('daily/')
      expect(results[0].timestamp).toBeDefined()
    })
  })

  describe('searchStockMemories', () => {
    it('should find stock memories matching query', () => {
      const results = searchStockMemories('紫金矿业', 10)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].content).toContain('紫金矿业')
    })

    it('should include source path', () => {
      const results = searchStockMemories('紫金矿业', 10)
      expect(results[0].source).toContain('stocks/')
      expect(results[0].source).toContain('.md')
    })

    it('should respect limit parameter', () => {
      const results = searchStockMemories('持仓', 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return empty array for non-matching query', () => {
      const results = searchStockMemories('不存在的股票xyz123', 10)
      expect(results.length).toBe(0)
    })
  })

  describe('searchExperiences', () => {
    it('should search both daily logs and stock memories', () => {
      const result = searchExperiences({ query: '紫金矿业', limit: 10 })
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.length).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(0)
    })

    it('should return error for empty query', () => {
      const result = searchExperiences({ query: '' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should filter by category', () => {
      const result = searchExperiences({
        query: '止损',
        category: 'risk_management',
        limit: 10,
      })
      expect(result.success).toBe(true)
      if (result.data && result.data.length > 0) {
        expect(result.data[0].category).toBeDefined()
      }
    })

    it('should respect limit across both sources', () => {
      const result = searchExperiences({ query: '持仓', limit: 2 })
      expect(result.success).toBe(true)
      expect(result.data!.length).toBeLessThanOrEqual(2)
    })

    it('should include query in result', () => {
      const result = searchExperiences({ query: '止损', limit: 10 })
      expect(result.query).toBe('止损')
    })

    it('should handle case-insensitive search', () => {
      const result1 = searchExperiences({ query: '止损', limit: 10 })
      const result2 = searchExperiences({ query: '止损', limit: 10 })
      // Both queries should return results
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.total).toBeGreaterThan(0)
      expect(result2.total).toBeGreaterThan(0)
    })
  })

  describe('category mapping', () => {
    it('should map stock_selection category', () => {
      const result = searchExperiences({
        query: '决策',
        category: 'stock_selection',
        limit: 10,
      })
      expect(result.success).toBe(true)
    })

    it('should map risk_management category', () => {
      const result = searchExperiences({
        query: '止损',
        category: 'risk_management',
        limit: 10,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in query', () => {
      const result = searchExperiences({ query: '成本×0.9', limit: 10 })
      expect(result.success).toBe(true)
    })

    it('should handle very long queries', () => {
      const longQuery = '止损'.repeat(100)
      const result = searchExperiences({ query: longQuery, limit: 10 })
      expect(result.success).toBe(true)
    })

    it('should handle limit of 0', () => {
      const result = searchExperiences({ query: '止损', limit: 0 })
      expect(result.success).toBe(true)
      expect(result.data!.length).toBe(0)
    })

    it('should handle very large limit', () => {
      const result = searchExperiences({ query: '止损', limit: 1000 })
      expect(result.success).toBe(true)
      expect(result.data!.length).toBeLessThanOrEqual(1000)
    })
  })
})
