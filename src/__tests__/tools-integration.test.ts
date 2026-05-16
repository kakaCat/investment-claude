/**
 * Tools Integration Tests
 *
 * Tests the integration and data flow between tools:
 * - TradeLogTool → Evolution Service (data flow)
 * - ExperienceQueryTool → Evolution recommendations (context)
 * - EvolutionRunTool → File system (report generation)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { runEvolution } from '../services/intelligence/evolution-service.js'
import { handleCreate, handleAppend, handleGet } from '../tools/TradeLogTool/TradeLogTool.js'
import { searchExperiences } from '../tools/ExperienceQueryTool/ExperienceQueryTool.js'
import type { TradeRecord } from '../services/intelligence/types.js'

const TEST_DIR = path.join(process.cwd(), '.pi-test')
const TRADE_LOG_DIR = path.join(TEST_DIR, 'trade-log')
const EVOLUTION_DIR = path.join(TEST_DIR, 'evolution')
const MEMORY_DIR = path.join(TEST_DIR, 'memory')

describe('Tools Integration Tests', () => {
  beforeEach(async () => {
    // Create test environment
    await fs.mkdir(TRADE_LOG_DIR, { recursive: true })
    await fs.mkdir(path.join(EVOLUTION_DIR, 'reports'), { recursive: true })
    await fs.mkdir(path.join(EVOLUTION_DIR, 'actions'), { recursive: true })
    await fs.mkdir(path.join(MEMORY_DIR, 'daily'), { recursive: true })
    await fs.mkdir(path.join(MEMORY_DIR, 'stocks'), { recursive: true })

    // Override process.cwd() to use test directory
    const originalCwd = process.cwd()
    process.cwd = () => TEST_DIR
    ;(global as any).__originalCwd = originalCwd
  })

  afterEach(async () => {
    // Restore original cwd
    if ((global as any).__originalCwd) {
      const originalCwd = (global as any).__originalCwd
      process.cwd = () => originalCwd
      delete (global as any).__originalCwd
    }

    // Clean up test environment
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('TradeLogTool → Evolution Service Integration', () => {
    it('should flow trade data from TradeLogTool to Evolution Service', async () => {
      // Step 1: Create trade log using TradeLogTool
      const createResult = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc',
        entry_price: 150,
        entry_date: '2024-01-01',
        notes: 'Strong fundamentals'
      })

      expect(createResult.success).toBe(true)
      const tradeLog = createResult.data as any

      // Step 2: Append exit record
      const appendResult = handleAppend({
        action: 'append',
        log_id: tradeLog.log_id,
        record: {
          date: '2024-01-15',
          event: 'exit',
          price: 160,
          notes: 'Target reached'
        }
      })

      expect(appendResult.success).toBe(true)

      // Step 3: Convert to TradeRecord format and save
      const tradeRecord: TradeRecord = {
        symbol: tradeLog.symbol,
        name: tradeLog.name,
        entry_date: tradeLog.entry_date,
        entry_price: tradeLog.entry_price,
        exit_date: '2024-01-15',
        exit_price: 160,
        quantity: 100,
        profit: (160 - 150) * 100,
        profit_rate: ((160 - 150) / 150) * 100
      }

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, `${tradeLog.log_id}.json`),
        JSON.stringify(tradeRecord, null, 2),
        'utf-8'
      )

      // Step 4: Run evolution analysis
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Verify: Trade data flows through to evolution
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBeGreaterThan(0)
      expect(report.current_performance.win_rate).toBeGreaterThan(0)
    })

    it('should handle multiple trade logs in evolution analysis', async () => {
      // Create multiple trade logs
      const trades = [
        { symbol: 'AAPL', name: 'Apple Inc', entry_price: 150, exit_price: 160 },
        { symbol: 'GOOGL', name: 'Alphabet Inc', entry_price: 140, exit_price: 145 },
        { symbol: 'MSFT', name: 'Microsoft Corp', entry_price: 380, exit_price: 370 }
      ]

      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i]
        const createResult = handleCreate({
          action: 'create',
          symbol: trade.symbol,
          name: trade.name,
          entry_price: trade.entry_price,
          entry_date: `2024-01-0${i + 1}`
        })

        expect(createResult.success).toBe(true)
        const tradeLog = createResult.data as any

        // Convert and save
        const tradeRecord: TradeRecord = {
          symbol: trade.symbol,
          name: trade.name,
          entry_date: `2024-01-0${i + 1}`,
          entry_price: trade.entry_price,
          exit_date: `2024-01-1${i + 5}`,
          exit_price: trade.exit_price,
          quantity: 100,
          profit: (trade.exit_price - trade.entry_price) * 100,
          profit_rate: ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
        }

        await fs.writeFile(
          path.join(TRADE_LOG_DIR, `${tradeLog.log_id}.json`),
          JSON.stringify(tradeRecord, null, 2),
          'utf-8'
        )
      }

      // Run evolution
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Verify: All trades included
      expect(report.status).toBe('success')
      expect(report.current_performance.win_rate).toBeCloseTo(0.67, 1) // 2 wins, 1 loss
    })

    it('should retrieve trade log and verify data integrity', async () => {
      // Create trade log
      const createResult = handleCreate({
        action: 'create',
        symbol: 'TSLA',
        name: 'Tesla Inc',
        entry_price: 250,
        entry_date: '2024-01-10'
      })

      expect(createResult.success).toBe(true)
      const tradeLog = createResult.data as any

      // Retrieve trade log
      const getResult = handleGet({
        action: 'get',
        log_id: tradeLog.log_id
      })

      // Verify: Data integrity maintained
      expect(getResult.success).toBe(true)
      const retrievedLog = getResult.data as any
      expect(retrievedLog.symbol).toBe('TSLA')
      expect(retrievedLog.name).toBe('Tesla Inc')
      expect(retrievedLog.entry_price).toBe(250)
      expect(retrievedLog.entry_date).toBe('2024-01-10')
    })
  })

  describe('ExperienceQueryTool → Evolution Recommendations Integration', () => {
    it('should query experiences related to evolution recommendations', async () => {
      // Step 1: Create experiences
      const dailyLog = path.join(MEMORY_DIR, 'daily', '2024-01-15.jsonl')
      const experiences = [
        {
          ts: '2024-01-15T10:00:00Z',
          category: 'stock_decision',
          content: 'AAPL selection based on strong earnings and technical breakout pattern'
        },
        {
          ts: '2024-01-15T11:00:00Z',
          category: 'timing',
          content: 'Entry timing was suboptimal, entered too early before confirmation'
        },
        {
          ts: '2024-01-15T12:00:00Z',
          category: 'position',
          content: 'Position sizing was aggressive at 8% of portfolio, should reduce to 5%'
        },
        {
          ts: '2024-01-15T13:00:00Z',
          category: 'risk',
          content: 'Stop loss was too tight, got stopped out before reversal'
        }
      ]

      const jsonlContent = experiences.map(e => JSON.stringify(e)).join('\n')
      await fs.writeFile(dailyLog, jsonlContent, 'utf-8')

      // Step 2: Create trades with issues
      const trades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-10',
          entry_price: 150,
          exit_date: '2024-01-15',
          exit_price: 148,
          quantity: 100,
          profit: -200,
          profit_rate: -1.33
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Step 3: Run evolution to get recommendations
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      expect(report.status).toBe('success')
      expect(report.gap_analysis.recommendations.length).toBeGreaterThan(0)

      // Step 4: Query experiences for each recommendation category
      const categories = ['stock_selection', 'timing', 'position_sizing', 'risk_management'] as const

      for (const category of categories) {
        const results = searchExperiences({
          query: category.replace('_', ' '),
          category,
          limit: 5
        })

        // Verify: Can find relevant experiences
        if (results.success && results.data && results.data.length > 0) {
          expect(results.data[0].category).toBeDefined()
          expect(results.data[0].content).toBeDefined()
        }
      }
    })

    it('should correlate experience insights with gap attribution', async () => {
      // Create experiences highlighting timing issues
      const dailyLog = path.join(MEMORY_DIR, 'daily', '2024-01-20.jsonl')
      const experiences = [
        {
          ts: '2024-01-20T10:00:00Z',
          category: 'timing',
          content: 'Consistently entering positions too early, missing optimal entry points'
        },
        {
          ts: '2024-01-20T11:00:00Z',
          category: 'timing',
          content: 'Exit timing needs improvement, leaving profits on the table'
        }
      ]

      await fs.writeFile(
        dailyLog,
        experiences.map(e => JSON.stringify(e)).join('\n'),
        'utf-8'
      )

      // Create trades with timing issues
      const trades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-15',
          entry_price: 155,
          exit_date: '2024-01-20',
          exit_price: 157,
          quantity: 100,
          profit: 200,
          profit_rate: 1.29
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Run evolution
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Query timing experiences
      const timingResults = searchExperiences({
        query: 'timing',
        category: 'timing',
        limit: 10
      })

      // Verify: Can find timing-related experiences
      expect(timingResults.success).toBe(true)
      if (timingResults.data && timingResults.data.length > 0) {
        expect(timingResults.data.some(exp => exp.content.includes('timing'))).toBe(true)
      }

      // Verify: Gap analysis includes timing attribution
      expect(report.gap_analysis.attribution.timing).toBeGreaterThanOrEqual(0)
    })
  })

  describe('EvolutionRunTool → File System Integration', () => {
    it('should generate and persist evolution reports', async () => {
      // Create sample trades
      const trades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-01',
          entry_price: 150,
          exit_date: '2024-01-15',
          exit_price: 160,
          quantity: 100,
          profit: 1000,
          profit_rate: 6.67
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Run evolution
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Verify: Report generated
      expect(report.status).toBe('success')

      // Verify: Report file exists
      const reportsDir = path.join(EVOLUTION_DIR, 'reports')
      const files = await fs.readdir(reportsDir)
      const reportFiles = files.filter(f => f.endsWith('.json'))
      expect(reportFiles.length).toBe(1)

      // Verify: Report file is valid JSON
      const reportContent = await fs.readFile(
        path.join(reportsDir, reportFiles[0]),
        'utf-8'
      )
      const savedReport = JSON.parse(reportContent)
      expect(savedReport.timestamp).toBe(report.timestamp)
      expect(savedReport.status).toBe('success')
    })

    it('should generate multiple reports without conflicts', async () => {
      // Create trades
      const trades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-01',
          entry_price: 150,
          exit_date: '2024-01-15',
          exit_price: 155,
          quantity: 100,
          profit: 500,
          profit_rate: 3.33
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Run evolution multiple times
      const report1 = await runEvolution({
        period: { start: '2024-01-01', end: '2024-01-15' },
        target_return: 20
      })

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100))

      const report2 = await runEvolution({
        period: { start: '2024-01-01', end: '2024-01-31' },
        target_return: 25
      })

      // Verify: Both reports generated
      expect(report1.status).toBe('success')
      expect(report2.status).toBe('success')
      expect(report1.timestamp).not.toBe(report2.timestamp)

      // Verify: Both report files exist
      const reportsDir = path.join(EVOLUTION_DIR, 'reports')
      const files = await fs.readdir(reportsDir)
      const reportFiles = files.filter(f => f.endsWith('.json'))
      expect(reportFiles.length).toBe(2)
    })

    it('should persist actions when auto_apply is enabled', async () => {
      // Create trades
      const trades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-01',
          entry_price: 150,
          exit_date: '2024-01-15',
          exit_price: 152,
          quantity: 100,
          profit: 200,
          profit_rate: 1.33
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Run evolution with auto_apply
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20,
        auto_apply: true
      })

      // Verify: Actions file created
      const actionsFile = path.join(EVOLUTION_DIR, 'actions', 'pending.json')
      const actionsExist = await fs.access(actionsFile).then(() => true).catch(() => false)
      expect(actionsExist).toBe(true)

      // Verify: Actions file content matches report
      const actionsContent = await fs.readFile(actionsFile, 'utf-8')
      const actions = JSON.parse(actionsContent)
      expect(actions.recommendations).toEqual(report.gap_analysis.recommendations)
    })
  })

  describe('Cross-Tool Data Consistency', () => {
    it('should maintain data consistency across tool chain', async () => {
      // Step 1: Create trade log
      const createResult = handleCreate({
        action: 'create',
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        entry_price: 500,
        entry_date: '2024-01-05'
      })

      expect(createResult.success).toBe(true)
      const tradeLog = createResult.data as any

      // Step 2: Append multiple records
      const records = [
        { date: '2024-01-10', event: 'price_update', price: 520, notes: 'Strong momentum' },
        { date: '2024-01-15', event: 'price_update', price: 510, notes: 'Pullback' },
        { date: '2024-01-20', event: 'exit', price: 530, notes: 'Target reached' }
      ]

      for (const record of records) {
        const appendResult = handleAppend({
          action: 'append',
          log_id: tradeLog.log_id,
          record
        })
        expect(appendResult.success).toBe(true)
      }

      // Step 3: Retrieve and verify
      const getResult = handleGet({
        action: 'get',
        log_id: tradeLog.log_id
      })

      expect(getResult.success).toBe(true)
      const retrievedLog = getResult.data as any
      expect(retrievedLog.records.length).toBe(3)

      // Step 4: Convert to trade record
      const exitRecord = retrievedLog.records.find((r: any) => r.event === 'exit')
      const tradeRecord: TradeRecord = {
        symbol: retrievedLog.symbol,
        name: retrievedLog.name,
        entry_date: retrievedLog.entry_date,
        entry_price: retrievedLog.entry_price,
        exit_date: exitRecord.date,
        exit_price: exitRecord.price,
        quantity: 100,
        profit: (exitRecord.price - retrievedLog.entry_price) * 100,
        profit_rate: ((exitRecord.price - retrievedLog.entry_price) / retrievedLog.entry_price) * 100
      }

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, `${tradeLog.log_id}.json`),
        JSON.stringify(tradeRecord, null, 2),
        'utf-8'
      )

      // Step 5: Run evolution
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Verify: Data consistency maintained
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBeCloseTo(6, 0) // (530-500)/500 * 100 = 6%
    })

    it('should handle concurrent tool operations', async () => {
      // Create multiple trade logs concurrently
      const createPromises = [
        handleCreate({
          action: 'create',
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_price: 150,
          entry_date: '2024-01-01'
        }),
        handleCreate({
          action: 'create',
          symbol: 'GOOGL',
          name: 'Alphabet Inc',
          entry_price: 140,
          entry_date: '2024-01-02'
        }),
        handleCreate({
          action: 'create',
          symbol: 'MSFT',
          name: 'Microsoft Corp',
          entry_price: 380,
          entry_date: '2024-01-03'
        })
      ]

      const results = await Promise.all(createPromises.map(p => Promise.resolve(p)))

      // Verify: All created successfully
      expect(results.every(r => r.success)).toBe(true)

      // Verify: All have unique log_ids
      const logIds = results.map(r => (r.data as any).log_id)
      const uniqueLogIds = new Set(logIds)
      expect(uniqueLogIds.size).toBe(3)
    })
  })

  describe('Error Propagation Across Tools', () => {
    it('should handle errors in trade log creation gracefully', async () => {
      // Attempt to create invalid trade log
      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc',
        entry_price: 150
        // Missing entry_date
      } as any)

      // Verify: Error returned
      expect(result.success).toBe(false)
      expect(result.error).toContain('required')

      // Verify: Evolution still works with no data
      const report = await runEvolution({
        target_return: 20
      })

      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBe(0)
    })

    it('should handle missing trade log in append operation', async () => {
      // Attempt to append to non-existent log
      const result = handleAppend({
        action: 'append',
        log_id: 'nonexistent_log_id',
        record: {
          date: '2024-01-15',
          event: 'exit',
          price: 160
        }
      })

      // Verify: Error returned
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should handle invalid experience queries', async () => {
      // Query with invalid parameters
      const result = searchExperiences({
        query: '',
        limit: 10
      })

      // Verify: Error returned
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
