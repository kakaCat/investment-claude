/**
 * Evolution Service Tests
 *
 * Tests for the main evolution orchestrator including:
 * - Complete evolution workflow
 * - Period filtering
 * - Report generation
 * - Auto-apply mode
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  runEvolution,
  loadTrades,
  defineTargetPerformance,
  saveReport,
  saveActions,
  getLatestReport
} from '../evolution-service'
import type { TradeRecord, EvolutionReport } from '../types'

// Mock file system
vi.mock('fs/promises')

const mockFs = fs as any

describe('Evolution Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/test')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('defineTargetPerformance', () => {
    it('should create target metrics based on target return', () => {
      const target = defineTargetPerformance(20)

      expect(target.total_return).toBe(20)
      expect(target.win_rate).toBe(0.6)
      expect(target.avg_profit).toBe(0.3) // 20 * 0.015
      expect(target.avg_loss).toBe(-0.16) // -20 * 0.008
      expect(target.max_drawdown).toBe(6) // 20 * 0.3
      expect(target.sharpe_ratio).toBe(1.5)
    })

    it('should scale metrics with different target returns', () => {
      const target = defineTargetPerformance(50)

      expect(target.total_return).toBe(50)
      expect(target.avg_profit).toBe(0.75) // 50 * 0.015
      expect(target.avg_loss).toBe(-0.4) // -50 * 0.008
      expect(target.max_drawdown).toBe(15) // 50 * 0.3
    })
  })

  describe('loadTrades', () => {
    it('should return empty array when directory does not exist', async () => {
      vi.mocked(mockFs.access).mockRejectedValue(new Error('ENOENT'))

      const trades = await loadTrades()

      expect(trades).toEqual([])
      expect(mockFs.access).toHaveBeenCalledWith('/test/.pi/trade-log')
    })

    it('should return empty array when no JSON files found', async () => {
      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockResolvedValue(['file1.md', 'file2.txt'] as any)

      const trades = await loadTrades()

      expect(trades).toEqual([])
    })

    it('should load trades from JSON files', async () => {
      const sampleTrades: TradeRecord[] = [
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
          exit_price: 135,
          quantity: 50,
          profit: -250,
          profit_rate: -3.57
        }
      ]

      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockResolvedValue(['trades1.json', 'trades2.json'] as any)
      vi.mocked(mockFs.readFile)
        .mockResolvedValueOnce(JSON.stringify([sampleTrades[0]]))
        .mockResolvedValueOnce(JSON.stringify([sampleTrades[1]]))

      const trades = await loadTrades()

      expect(trades).toHaveLength(2)
      expect(trades[0].symbol).toBe('AAPL')
      expect(trades[1].symbol).toBe('GOOGL')
    })

    it('should filter trades by period', async () => {
      const sampleTrades: TradeRecord[] = [
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
          entry_date: '2024-02-01',
          entry_price: 140,
          exit_date: '2024-02-15',
          exit_price: 145,
          quantity: 50,
          profit: 250,
          profit_rate: 3.57
        }
      ]

      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockResolvedValue(['trades.json'] as any)
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(sampleTrades))

      const trades = await loadTrades({
        start: '2024-01-01',
        end: '2024-01-31'
      })

      expect(trades).toHaveLength(1)
      expect(trades[0].symbol).toBe('AAPL')
    })

    it('should handle single trade object', async () => {
      const singleTrade: TradeRecord = {
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

      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockResolvedValue(['trade.json'] as any)
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(singleTrade))

      const trades = await loadTrades()

      expect(trades).toHaveLength(1)
      expect(trades[0].symbol).toBe('AAPL')
    })

    it('should continue loading when one file fails', async () => {
      const validTrade: TradeRecord = {
        symbol: 'AAPL',
        name: 'Apple Inc',
        entry_date: '2024-01-01',
        entry_price: 150,
        quantity: 100
      }

      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockResolvedValue(['valid.json', 'invalid.json'] as any)
      vi.mocked(mockFs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validTrade))
        .mockRejectedValueOnce(new Error('Invalid JSON'))

      const trades = await loadTrades()

      expect(trades).toHaveLength(1)
      expect(trades[0].symbol).toBe('AAPL')
    })
  })

  describe('saveReport', () => {
    it('should save report to file system', async () => {
      const report: EvolutionReport = {
        timestamp: '2024-01-15T10:30:00.000Z',
        period: { start: '2024-01-01', end: '2024-01-31' },
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

      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined)
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined)

      await saveReport(report)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/test/.pi/evolution/reports',
        { recursive: true }
      )
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/test/.pi/evolution/reports/2024-01-15-'),
        expect.stringContaining('"status": "success"'),
        'utf-8'
      )
    })
  })

  describe('saveActions', () => {
    it('should save recommendations to pending actions', async () => {
      const recommendations = [
        'Improve stock selection',
        'Optimize timing'
      ]

      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined)
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined)

      await saveActions(recommendations)

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/test/.pi/evolution/actions',
        { recursive: true }
      )
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/.pi/evolution/actions/pending.json',
        expect.stringContaining('"status": "pending"'),
        'utf-8'
      )
    })
  })

  describe('getLatestReport', () => {
    it('should return null when no reports exist', async () => {
      vi.mocked(mockFs.readdir).mockRejectedValue(new Error('ENOENT'))

      const report = await getLatestReport()

      expect(report).toBeNull()
    })

    it('should return latest report', async () => {
      const latestReport: EvolutionReport = {
        timestamp: '2024-01-15T10:30:00.000Z',
        period: { start: '2024-01-01', end: '2024-01-31' },
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

      vi.mocked(mockFs.readdir).mockResolvedValue([
        '2024-01-10-103000.json',
        '2024-01-15-103000.json',
        '2024-01-05-103000.json'
      ] as any)
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(latestReport))

      const report = await getLatestReport()

      expect(report).not.toBeNull()
      expect(report?.timestamp).toBe('2024-01-15T10:30:00.000Z')
      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/test/.pi/evolution/reports/2024-01-15-103000.json',
        'utf-8'
      )
    })
  })

  describe('runEvolution', () => {
    beforeEach(() => {
      // Mock all file operations
      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined)
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined)
    })

    it('should run complete evolution cycle with sample data', async () => {
      const sampleTrades: TradeRecord[] = [
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
        }
      ]

      vi.mocked(mockFs.readdir).mockResolvedValue(['trades.json'] as any)
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(sampleTrades))

      const report = await runEvolution({
        target_return: 20,
        auto_apply: false
      })

      expect(report.status).toBe('success')
      expect(report.current_performance).toBeDefined()
      expect(report.target_performance.total_return).toBe(20)
      expect(report.gap_analysis).toBeDefined()
      expect(report.actions_taken).toEqual([])
    })

    it('should use default period when not specified', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue([] as any)

      const report = await runEvolution()

      expect(report.period.start).toBeDefined()
      expect(report.period.end).toBeDefined()
      // Period should be approximately 30 days
      const start = new Date(report.period.start)
      const end = new Date(report.period.end)
      const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBeGreaterThanOrEqual(29)
      expect(daysDiff).toBeLessThanOrEqual(31)
    })

    it('should use custom period when specified', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue([] as any)

      const report = await runEvolution({
        period: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      })

      expect(report.period.start).toBe('2024-01-01')
      expect(report.period.end).toBe('2024-01-31')
    })

    it('should save actions when auto_apply is true', async () => {
      const sampleTrades: TradeRecord[] = [
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

      vi.mocked(mockFs.readdir).mockResolvedValue(['trades.json'] as any)
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(sampleTrades))

      const report = await runEvolution({
        target_return: 20,
        auto_apply: true
      })

      expect(report.status).toBe('success')
      expect(report.actions_taken.length).toBeGreaterThan(0)
      expect(report.actions_taken[0]).toContain('recommendations')
      // Verify saveActions was called
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pending.json'),
        expect.any(String),
        'utf-8'
      )
    })

    it('should handle errors gracefully', async () => {
      // Mock a real error during file operations (not just missing directory)
      vi.mocked(mockFs.access).mockResolvedValue(undefined)
      vi.mocked(mockFs.readdir).mockRejectedValue(new Error('Permission denied'))

      const report = await runEvolution()

      // Service handles errors gracefully and returns success with empty data
      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBe(0)
    })

    it('should save report even on failure', async () => {
      vi.mocked(mockFs.access).mockRejectedValue(new Error('Test error'))
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined)
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined)

      await runEvolution()

      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should handle empty trade data', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue([] as any)

      const report = await runEvolution()

      expect(report.status).toBe('success')
      expect(report.current_performance.total_return).toBe(0)
      expect(report.current_performance.win_rate).toBe(0)
    })
  })
})
