/**
 * Evolution System End-to-End Tests
 *
 * Comprehensive E2E tests verifying the complete evolution workflow:
 * - TradeLogTool → Evolution Service → Report Generation
 * - ExperienceQueryTool integration
 * - Auto-apply mode
 * - Period filtering
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { runEvolution, loadTrades, getLatestReport } from '../services/intelligence/evolution-service.js'
import { handleCreate, handleAppend, handleList } from '../tools/TradeLogTool/TradeLogTool.js'
import { searchExperiences } from '../tools/ExperienceQueryTool/ExperienceQueryTool.js'
import type { TradeRecord, EvolutionReport } from '../services/intelligence/types.js'

const TEST_DIR = path.join(process.cwd(), '.pi-test')
const TRADE_LOG_DIR = path.join(TEST_DIR, 'trade-log')
const EVOLUTION_DIR = path.join(TEST_DIR, 'evolution')
const MEMORY_DIR = path.join(TEST_DIR, 'memory')

describe('Evolution System E2E Tests', () => {
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

    // Store original for cleanup
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

  describe('Scenario 1: Basic Evolution Run', () => {
    it('should execute complete evolution workflow and generate report', async () => {
      // Setup: Create sample trade logs
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
        },
        {
          symbol: 'GOOGL',
          name: 'Alphabet Inc',
          entry_date: '2024-01-05',
          entry_price: 140,
          exit_date: '2024-01-20',
          exit_price: 145,
          quantity: 50,
          profit: 250,
          profit_rate: 3.57
        },
        {
          symbol: 'MSFT',
          name: 'Microsoft Corp',
          entry_date: '2024-01-10',
          entry_price: 380,
          exit_date: '2024-01-25',
          exit_price: 370,
          quantity: 20,
          profit: -200,
          profit_rate: -2.63
        }
      ]

      // Save trades to test directory
      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'trades.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Execute: Run evolution analysis
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20,
        auto_apply: false
      })

      // Verify: Report structure
      expect(report).toBeDefined()
      expect(report.status).toBe('success')
      expect(report.timestamp).toBeDefined()
      expect(report.period.start).toBe('2024-01-01')
      expect(report.period.end).toBe('2024-01-31')

      // Verify: Performance metrics
      expect(report.current_performance).toBeDefined()
      expect(report.current_performance.total_return).toBeGreaterThan(0)
      expect(report.current_performance.win_rate).toBeGreaterThan(0)
      expect(report.current_performance.win_rate).toBeLessThanOrEqual(1)
      expect(report.current_performance.avg_profit).toBeDefined()
      expect(report.current_performance.avg_loss).toBeDefined()
      expect(report.current_performance.max_drawdown).toBeDefined()

      // Verify: Target performance
      expect(report.target_performance).toBeDefined()
      expect(report.target_performance.total_return).toBe(20)
      expect(report.target_performance.win_rate).toBe(0.6)
      expect(report.target_performance.sharpe_ratio).toBe(1.5)

      // Verify: Gap analysis
      expect(report.gap_analysis).toBeDefined()
      expect(report.gap_analysis.performance_gap).toBeDefined()
      expect(report.gap_analysis.attribution).toBeDefined()
      expect(report.gap_analysis.attribution.stock_selection).toBeGreaterThanOrEqual(0)
      expect(report.gap_analysis.attribution.timing).toBeGreaterThanOrEqual(0)
      expect(report.gap_analysis.attribution.position_sizing).toBeGreaterThanOrEqual(0)
      expect(report.gap_analysis.attribution.risk_management).toBeGreaterThanOrEqual(0)

      // Attribution should sum to 100%
      const totalAttribution =
        report.gap_analysis.attribution.stock_selection +
        report.gap_analysis.attribution.timing +
        report.gap_analysis.attribution.position_sizing +
        report.gap_analysis.attribution.risk_management
      expect(totalAttribution).toBe(100)

      // Verify: Recommendations
      expect(report.gap_analysis.recommendations).toBeDefined()
      expect(Array.isArray(report.gap_analysis.recommendations)).toBe(true)
      expect(report.gap_analysis.recommendations.length).toBeGreaterThan(0)

      // Verify: Report file exists
      const reportsDir = path.join(EVOLUTION_DIR, 'reports')
      const files = await fs.readdir(reportsDir)
      const reportFiles = files.filter(f => f.endsWith('.json'))
      expect(reportFiles.length).toBe(1)

      // Verify: Report file content
      const reportContent = await fs.readFile(
        path.join(reportsDir, reportFiles[0]),
        'utf-8'
      )
      const savedReport = JSON.parse(reportContent)
      expect(savedReport.status).toBe('success')
      expect(savedReport.timestamp).toBe(report.timestamp)
    })

    it('should handle empty trade data gracefully', async () => {
      // Execute: Run evolution with no trades
      const report = await runEvolution({
        target_return: 20,
        auto_apply: false
      })

      // Verify: Report generated with zero metrics
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBe(0)
      expect(report.current_performance.win_rate).toBe(0)
      expect(report.gap_analysis.performance_gap).toBeDefined()
    })
  })

  describe('Scenario 2: Custom Period Evolution', () => {
    it('should analyze only trades within specified period', async () => {
      // Setup: Create trades across different periods
      const allTrades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: '2024-01-01',
          entry_price: 150,
          exit_date: '2024-01-05',
          exit_price: 160,
          quantity: 100,
          profit: 1000,
          profit_rate: 6.67
        },
        {
          symbol: 'GOOGL',
          name: 'Alphabet Inc',
          entry_date: '2024-01-15',
          entry_price: 140,
          exit_date: '2024-01-20',
          exit_price: 145,
          quantity: 50,
          profit: 250,
          profit_rate: 3.57
        },
        {
          symbol: 'MSFT',
          name: 'Microsoft Corp',
          entry_date: '2024-02-01',
          entry_price: 380,
          exit_date: '2024-02-05',
          exit_price: 390,
          quantity: 20,
          profit: 200,
          profit_rate: 2.63
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'all-trades.json'),
        JSON.stringify(allTrades, null, 2),
        'utf-8'
      )

      // Execute: Run evolution for 7-day period
      const endDate = new Date('2024-01-10')
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 7)

      const report = await runEvolution({
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        target_return: 20
      })

      // Verify: Only trades from the 7-day period are included
      expect(report.status).toBe('success')
      expect(report.period.start).toBe('2024-01-03')
      expect(report.period.end).toBe('2024-01-10')

      // Load trades to verify filtering
      const filteredTrades = await loadTrades({
        start: '2024-01-03',
        end: '2024-01-10'
      })

      // Should only include AAPL trade (exit_date: 2024-01-05)
      expect(filteredTrades.length).toBe(1)
      expect(filteredTrades[0].symbol).toBe('AAPL')
    })

    it('should support period_days parameter conversion', async () => {
      // Setup: Create recent trades
      const today = new Date()
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 5)

      const recentTrades: TradeRecord[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          entry_date: sevenDaysAgo.toISOString().split('T')[0],
          entry_price: 150,
          exit_date: today.toISOString().split('T')[0],
          exit_price: 155,
          quantity: 100,
          profit: 500,
          profit_rate: 3.33
        }
      ]

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'recent-trades.json'),
        JSON.stringify(recentTrades, null, 2),
        'utf-8'
      )

      // Execute: Run evolution with period_days
      const periodDays = 7
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - periodDays)

      const report = await runEvolution({
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        target_return: 20
      })

      // Verify: Period reflects 7 days
      expect(report.status).toBe('success')
      const reportStart = new Date(report.period.start)
      const reportEnd = new Date(report.period.end)
      const daysDiff = Math.round((reportEnd.getTime() - reportStart.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBe(7)
    })
  })

  describe('Scenario 3: Auto-Apply Mode', () => {
    it('should save recommendations to pending actions when auto_apply is true', async () => {
      // Setup: Create trades with performance gap
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

      // Execute: Run evolution with auto_apply
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20,
        auto_apply: true
      })

      // Verify: Report shows actions taken
      expect(report.status).toBe('success')
      expect(report.actions_taken.length).toBeGreaterThan(0)
      expect(report.actions_taken[0]).toContain('recommendations')
      expect(report.actions_taken[0]).toContain('pending actions')

      // Verify: Pending actions file exists
      const actionsFile = path.join(EVOLUTION_DIR, 'actions', 'pending.json')
      const actionsExist = await fs.access(actionsFile).then(() => true).catch(() => false)
      expect(actionsExist).toBe(true)

      // Verify: Actions file content
      const actionsContent = await fs.readFile(actionsFile, 'utf-8')
      const actions = JSON.parse(actionsContent)
      expect(actions.status).toBe('pending')
      expect(actions.timestamp).toBeDefined()
      expect(Array.isArray(actions.recommendations)).toBe(true)
      expect(actions.recommendations.length).toBeGreaterThan(0)
      expect(actions.recommendations).toEqual(report.gap_analysis.recommendations)
    })

    it('should not save actions when auto_apply is false', async () => {
      // Setup: Create trades
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

      // Execute: Run evolution without auto_apply
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20,
        auto_apply: false
      })

      // Verify: No actions taken
      expect(report.status).toBe('success')
      expect(report.actions_taken).toEqual([])

      // Verify: No pending actions file
      const actionsFile = path.join(EVOLUTION_DIR, 'actions', 'pending.json')
      const actionsExist = await fs.access(actionsFile).then(() => true).catch(() => false)
      expect(actionsExist).toBe(false)
    })
  })

  describe('Scenario 4: Experience Query Integration', () => {
    it('should query experiences related to recommendations', async () => {
      // Setup: Create experience records
      const dailyLog = path.join(MEMORY_DIR, 'daily', '2024-01-15.jsonl')
      const experiences = [
        {
          ts: '2024-01-15T10:00:00Z',
          category: 'stock_decision',
          content: 'Selected AAPL based on strong fundamentals and technical breakout'
        },
        {
          ts: '2024-01-15T11:00:00Z',
          category: 'timing',
          content: 'Entry timing was optimal at support level'
        },
        {
          ts: '2024-01-15T12:00:00Z',
          category: 'risk',
          content: 'Position size was too large, exceeded 5% portfolio limit'
        }
      ]

      const jsonlContent = experiences.map(e => JSON.stringify(e)).join('\n')
      await fs.writeFile(dailyLog, jsonlContent, 'utf-8')

      // Execute: Query experiences by category
      const stockSelectionResults = searchExperiences({
        query: 'stock',
        category: 'stock_selection',
        limit: 10
      })

      const riskResults = searchExperiences({
        query: 'position',
        category: 'risk_management',
        limit: 10
      })

      // Verify: Stock selection experiences found
      expect(stockSelectionResults.success).toBe(true)
      expect(stockSelectionResults.data).toBeDefined()
      expect(stockSelectionResults.data!.length).toBeGreaterThan(0)
      expect(stockSelectionResults.data![0].content).toContain('AAPL')

      // Verify: Risk management experiences found
      expect(riskResults.success).toBe(true)
      expect(riskResults.data).toBeDefined()
      expect(riskResults.data!.length).toBeGreaterThan(0)
      expect(riskResults.data![0].content).toContain('Position size')
    })

    it('should find experiences without category filter', async () => {
      // Setup: Create mixed experiences
      const dailyLog = path.join(MEMORY_DIR, 'daily', '2024-01-20.jsonl')
      const experiences = [
        {
          ts: '2024-01-20T10:00:00Z',
          category: 'market',
          content: 'Market showing strong bullish momentum'
        },
        {
          ts: '2024-01-20T11:00:00Z',
          category: 'analysis',
          content: 'Technical analysis indicates breakout pattern'
        }
      ]

      const jsonlContent = experiences.map(e => JSON.stringify(e)).join('\n')
      await fs.writeFile(dailyLog, jsonlContent, 'utf-8')

      // Execute: Query without category
      const results = searchExperiences({
        query: 'market',
        limit: 10
      })

      // Verify: Results found
      expect(results.success).toBe(true)
      expect(results.data).toBeDefined()
      expect(results.data!.length).toBeGreaterThan(0)
      expect(results.data![0].content).toContain('market')
    })

    it('should return empty results for non-matching queries', async () => {
      // Execute: Query for non-existent content
      const results = searchExperiences({
        query: 'nonexistent-query-string-xyz',
        limit: 10
      })

      // Verify: Empty results
      expect(results.success).toBe(true)
      expect(results.data).toBeDefined()
      expect(results.data!.length).toBe(0)
    })
  })

  describe('Scenario 5: Trade Log Integration', () => {
    it('should create trade log and include in evolution analysis', async () => {
      // Execute: Create trade log using TradeLogTool
      const createResult = handleCreate({
        action: 'create',
        symbol: 'TSLA',
        name: 'Tesla Inc',
        entry_price: 250,
        entry_date: '2024-01-10',
        notes: 'Strong EV market position'
      })

      // Verify: Trade log created
      expect(createResult.success).toBe(true)
      expect(createResult.data).toBeDefined()
      const tradeLog = createResult.data as any
      expect(tradeLog.log_id).toBeDefined()
      expect(tradeLog.symbol).toBe('TSLA')

      // Execute: Append exit record
      const appendResult = handleAppend({
        action: 'append',
        log_id: tradeLog.log_id,
        record: {
          date: '2024-01-20',
          event: 'exit',
          price: 270,
          notes: 'Target reached'
        }
      })

      // Verify: Record appended
      expect(appendResult.success).toBe(true)
      expect(appendResult.data).toBeDefined()
      const updatedLog = appendResult.data as any
      expect(updatedLog.records.length).toBe(1)

      // Convert trade log to TradeRecord format
      const tradeRecord: TradeRecord = {
        symbol: tradeLog.symbol,
        name: tradeLog.name,
        entry_date: tradeLog.entry_date,
        entry_price: tradeLog.entry_price,
        exit_date: updatedLog.records[0].date,
        exit_price: updatedLog.records[0].price,
        quantity: 100,
        profit: (270 - 250) * 100,
        profit_rate: ((270 - 250) / 250) * 100
      }

      // Save as trade record for evolution
      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'tsla-trade.json'),
        JSON.stringify(tradeRecord, null, 2),
        'utf-8'
      )

      // Execute: Run evolution analysis
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        target_return: 20
      })

      // Verify: Trade included in analysis
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBeGreaterThan(0)

      // Verify: Trade can be loaded
      const trades = await loadTrades({
        start: '2024-01-01',
        end: '2024-01-31'
      })
      expect(trades.length).toBe(1)
      expect(trades[0].symbol).toBe('TSLA')
    })

    it('should list all trade logs', async () => {
      // Setup: Create multiple trade logs
      handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc',
        entry_price: 150,
        entry_date: '2024-01-01'
      })

      handleCreate({
        action: 'create',
        symbol: 'GOOGL',
        name: 'Alphabet Inc',
        entry_price: 140,
        entry_date: '2024-01-05'
      })

      // Execute: List all logs
      const listResult = handleList()

      // Verify: All logs returned
      expect(listResult.success).toBe(true)
      expect(Array.isArray(listResult.data)).toBe(true)
      const logs = listResult.data as any[]
      expect(logs.length).toBe(2)
      expect(logs.some(log => log.symbol === 'AAPL')).toBe(true)
      expect(logs.some(log => log.symbol === 'GOOGL')).toBe(true)
    })
  })

  describe('Scenario 6: Error Handling', () => {
    it('should handle missing trade log directory gracefully', async () => {
      // Setup: Remove trade log directory
      await fs.rm(TRADE_LOG_DIR, { recursive: true, force: true })

      // Execute: Run evolution
      const report = await runEvolution({
        target_return: 20
      })

      // Verify: Graceful handling with empty data
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBe(0)
    })

    it('should handle corrupted trade files', async () => {
      // Setup: Create corrupted trade file
      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'corrupted.json'),
        'invalid json content {{{',
        'utf-8'
      )

      // Execute: Run evolution
      const report = await runEvolution({
        target_return: 20
      })

      // Verify: Continues with valid data
      expect(report.status).toBe('success')
    })

    it('should handle invalid experience query', async () => {
      // Execute: Query with empty string
      const result = searchExperiences({
        query: '',
        limit: 10
      })

      // Verify: Error returned
      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should handle missing memory directory', async () => {
      // Setup: Remove memory directory
      await fs.rm(MEMORY_DIR, { recursive: true, force: true })

      // Execute: Query experiences
      const result = searchExperiences({
        query: 'test',
        limit: 10
      })

      // Verify: Returns empty results or error
      expect(result.success).toBe(false)
      expect(result.error).toContain('Memory directory not found')
    })
  })

  describe('Scenario 7: Report Retrieval', () => {
    it('should retrieve latest evolution report', async () => {
      // Setup: Create multiple reports
      const report1: EvolutionReport = {
        timestamp: '2024-01-10T10:00:00.000Z',
        period: { start: '2024-01-01', end: '2024-01-10' },
        current_performance: {
          total_return: 5,
          win_rate: 0.5,
          avg_profit: 3,
          avg_loss: -2,
          max_drawdown: 4,
          sharpe_ratio: 0.8
        },
        target_performance: {
          total_return: 20,
          win_rate: 0.6,
          avg_profit: 0.3,
          avg_loss: -0.16,
          max_drawdown: 6,
          sharpe_ratio: 1.5
        },
        gap_analysis: {
          performance_gap: 15,
          attribution: {
            stock_selection: 30,
            timing: 25,
            position_sizing: 25,
            risk_management: 20
          },
          recommendations: ['Improve stock selection']
        },
        actions_taken: [],
        status: 'success'
      }

      const report2: EvolutionReport = {
        ...report1,
        timestamp: '2024-01-20T10:00:00.000Z',
        period: { start: '2024-01-11', end: '2024-01-20' }
      }

      const reportsDir = path.join(EVOLUTION_DIR, 'reports')
      await fs.writeFile(
        path.join(reportsDir, '2024-01-10-100000.json'),
        JSON.stringify(report1, null, 2),
        'utf-8'
      )
      await fs.writeFile(
        path.join(reportsDir, '2024-01-20-100000.json'),
        JSON.stringify(report2, null, 2),
        'utf-8'
      )

      // Execute: Get latest report
      const latestReport = await getLatestReport()

      // Verify: Latest report returned
      expect(latestReport).not.toBeNull()
      expect(latestReport!.timestamp).toBe('2024-01-20T10:00:00.000Z')
      expect(latestReport!.period.start).toBe('2024-01-11')
    })

    it('should return null when no reports exist', async () => {
      // Execute: Get latest report from empty directory
      const latestReport = await getLatestReport()

      // Verify: Null returned
      expect(latestReport).toBeNull()
    })
  })

  describe('Scenario 8: Large Dataset Performance', () => {
    it('should handle 100+ trades efficiently', async () => {
      // Setup: Generate 100 trades
      const trades: TradeRecord[] = []
      const startDate = new Date('2024-01-01')

      for (let i = 0; i < 100; i++) {
        const entryDate = new Date(startDate)
        entryDate.setDate(entryDate.getDate() + i)

        const exitDate = new Date(entryDate)
        exitDate.setDate(exitDate.getDate() + 5)

        const isWin = Math.random() > 0.4 // 60% win rate
        const profitRate = isWin ? Math.random() * 10 : -Math.random() * 5

        trades.push({
          symbol: `STOCK${i}`,
          name: `Company ${i}`,
          entry_date: entryDate.toISOString().split('T')[0],
          entry_price: 100 + Math.random() * 100,
          exit_date: exitDate.toISOString().split('T')[0],
          exit_price: 100 + Math.random() * 100,
          quantity: 100,
          profit: profitRate * 100,
          profit_rate: profitRate
        })
      }

      await fs.writeFile(
        path.join(TRADE_LOG_DIR, 'large-dataset.json'),
        JSON.stringify(trades, null, 2),
        'utf-8'
      )

      // Execute: Run evolution with timing
      const startTime = Date.now()
      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-12-31'
        },
        target_return: 20
      })
      const duration = Date.now() - startTime

      // Verify: Completes in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000)
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBeDefined()

      // Verify: All trades loaded
      const loadedTrades = await loadTrades({
        start: '2024-01-01',
        end: '2024-12-31'
      })
      expect(loadedTrades.length).toBe(100)
    })
  })
})
