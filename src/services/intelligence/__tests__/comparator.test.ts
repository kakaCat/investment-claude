/**
 * Comparator Tests
 */

import { describe, it, expect } from 'vitest'
import {
  calculatePerformanceMetrics,
  calculateGap,
  analyzeStockSelection,
  analyzeTiming,
  analyzePositionSizing,
  analyzeRiskManagement,
  generateRecommendations
} from '../comparator'
import type { PerformanceMetrics, TradeRecord } from '../types'

describe('calculatePerformanceMetrics', () => {
  it('should calculate metrics from sample trades', () => {
    const trades: TradeRecord[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_date: '2024-01-01',
        entry_price: 100,
        exit_date: '2024-01-10',
        exit_price: 110,
        quantity: 100,
        profit: 1000,
        profit_rate: 10
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        entry_date: '2024-01-05',
        entry_price: 200,
        exit_date: '2024-01-15',
        exit_price: 190,
        quantity: 50,
        profit: -500,
        profit_rate: -5
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        entry_date: '2024-01-10',
        entry_price: 300,
        exit_date: '2024-01-20',
        exit_price: 315,
        quantity: 30,
        profit: 450,
        profit_rate: 5
      }
    ]

    const metrics = calculatePerformanceMetrics(trades)

    expect(metrics.total_return).toBeCloseTo(3.33, 1) // (10 - 5 + 5) / 3
    expect(metrics.win_rate).toBeCloseTo(0.667, 2) // 2 wins out of 3
    expect(metrics.avg_profit).toBeCloseTo(7.5, 1) // (10 + 5) / 2
    expect(metrics.avg_loss).toBe(-5) // -5 / 1
    expect(metrics.max_drawdown).toBeGreaterThanOrEqual(0)
    expect(metrics.sharpe_ratio).toBeDefined()
  })

  it('should handle empty trades', () => {
    const metrics = calculatePerformanceMetrics([])

    expect(metrics.total_return).toBe(0)
    expect(metrics.win_rate).toBe(0)
    expect(metrics.avg_profit).toBe(0)
    expect(metrics.avg_loss).toBe(0)
    expect(metrics.max_drawdown).toBe(0)
    expect(metrics.sharpe_ratio).toBe(0)
  })

  it('should handle all winning trades', () => {
    const trades: TradeRecord[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_date: '2024-01-01',
        entry_price: 100,
        exit_date: '2024-01-10',
        exit_price: 110,
        quantity: 100,
        profit: 1000,
        profit_rate: 10
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        entry_date: '2024-01-05',
        entry_price: 200,
        exit_date: '2024-01-15',
        exit_price: 220,
        quantity: 50,
        profit: 1000,
        profit_rate: 10
      }
    ]

    const metrics = calculatePerformanceMetrics(trades)

    expect(metrics.total_return).toBe(10)
    expect(metrics.win_rate).toBe(1)
    expect(metrics.avg_profit).toBe(10)
    expect(metrics.avg_loss).toBe(0)
  })

  it('should handle all losing trades', () => {
    const trades: TradeRecord[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_date: '2024-01-01',
        entry_price: 100,
        exit_date: '2024-01-10',
        exit_price: 90,
        quantity: 100,
        profit: -1000,
        profit_rate: -10
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        entry_date: '2024-01-05',
        entry_price: 200,
        exit_date: '2024-01-15',
        exit_price: 180,
        quantity: 50,
        profit: -1000,
        profit_rate: -10
      }
    ]

    const metrics = calculatePerformanceMetrics(trades)

    expect(metrics.total_return).toBe(-10)
    expect(metrics.win_rate).toBe(0)
    expect(metrics.avg_profit).toBe(0)
    expect(metrics.avg_loss).toBe(-10)
  })

  it('should filter out incomplete trades', () => {
    const trades: TradeRecord[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_date: '2024-01-01',
        entry_price: 100,
        exit_date: '2024-01-10',
        exit_price: 110,
        quantity: 100,
        profit: 1000,
        profit_rate: 10
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        entry_date: '2024-01-05',
        entry_price: 200,
        quantity: 50
        // No exit data
      }
    ]

    const metrics = calculatePerformanceMetrics(trades)

    // Should only count the completed trade
    expect(metrics.total_return).toBe(10)
    expect(metrics.win_rate).toBe(1)
  })

  it('should calculate max drawdown correctly', () => {
    const trades: TradeRecord[] = [
      {
        symbol: 'T1',
        name: 'Trade 1',
        entry_date: '2024-01-01',
        entry_price: 100,
        exit_date: '2024-01-02',
        exit_price: 110,
        quantity: 100,
        profit_rate: 10
      },
      {
        symbol: 'T2',
        name: 'Trade 2',
        entry_date: '2024-01-03',
        entry_price: 100,
        exit_date: '2024-01-04',
        exit_price: 80,
        quantity: 100,
        profit_rate: -20
      },
      {
        symbol: 'T3',
        name: 'Trade 3',
        entry_date: '2024-01-05',
        entry_price: 100,
        exit_date: '2024-01-06',
        exit_price: 90,
        quantity: 100,
        profit_rate: -10
      }
    ]

    const metrics = calculatePerformanceMetrics(trades)

    // Peak at 10, trough at -20, drawdown = 30
    expect(metrics.max_drawdown).toBeCloseTo(30, 0)
  })
})

describe('calculateGap', () => {
  it('should calculate performance gap and attribution', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15,
      sharpe_ratio: 0.5
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10,
      sharpe_ratio: 1.0
    }

    const gap = calculateGap(current, target)

    expect(gap.performance_gap).toBe(5)
    expect(gap.attribution.stock_selection).toBeGreaterThan(0)
    expect(gap.attribution.timing).toBeGreaterThan(0)
    expect(gap.attribution.position_sizing).toBeGreaterThan(0)
    expect(gap.attribution.risk_management).toBeGreaterThan(0)

    // Attribution should sum to 100%
    const total = Object.values(gap.attribution).reduce((sum, val) => sum + val, 0)
    expect(total).toBeCloseTo(100, 0)

    expect(gap.recommendations).toBeInstanceOf(Array)
    expect(gap.recommendations.length).toBeGreaterThan(0)
  })

  it('should handle zero gap scenario', () => {
    const metrics: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10,
      sharpe_ratio: 1.0
    }

    const gap = calculateGap(metrics, metrics)

    expect(gap.performance_gap).toBe(0)

    // Attribution should still sum to 100%
    const total = Object.values(gap.attribution).reduce((sum, val) => sum + val, 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('should handle negative gap (exceeding target)', () => {
    const current: PerformanceMetrics = {
      total_return: 15,
      win_rate: 0.8,
      avg_profit: 12,
      avg_loss: -3,
      max_drawdown: 8,
      sharpe_ratio: 1.5
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10,
      sharpe_ratio: 1.0
    }

    const gap = calculateGap(current, target)

    expect(gap.performance_gap).toBe(-5) // Exceeding target
  })
})

describe('analyzeStockSelection', () => {
  it('should calculate stock selection attribution based on win rate', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeStockSelection(current, target)

    expect(attribution).toBeCloseTo(20, 0) // 0.2 * 100
  })

  it('should handle zero win rate gap', () => {
    const metrics: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeStockSelection(metrics, metrics)

    expect(attribution).toBe(0)
  })
})

describe('analyzeTiming', () => {
  it('should calculate timing attribution based on profit/loss ratio', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeTiming(current, target)

    expect(attribution).toBeGreaterThan(0)
  })

  it('should handle zero avg_loss', () => {
    const current: PerformanceMetrics = {
      total_return: 10,
      win_rate: 1.0,
      avg_profit: 10,
      avg_loss: 0,
      max_drawdown: 0
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeTiming(current, target)

    expect(attribution).toBeGreaterThanOrEqual(0)
  })
})

describe('analyzePositionSizing', () => {
  it('should calculate position sizing attribution', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzePositionSizing(current, target)

    expect(attribution).toBeGreaterThan(0)
  })

  it('should weight higher when win rate is adequate', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.65, // Close to target
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzePositionSizing(current, target)

    expect(attribution).toBeGreaterThan(0)
  })
})

describe('analyzeRiskManagement', () => {
  it('should calculate risk management attribution based on drawdown', () => {
    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeRiskManagement(current, target)

    expect(attribution).toBeCloseTo(5, 0) // |10 - 15| * 100 = 5
  })

  it('should handle zero drawdown gap', () => {
    const metrics: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const attribution = analyzeRiskManagement(metrics, metrics)

    expect(attribution).toBe(0)
  })
})

describe('generateRecommendations', () => {
  it('should generate recommendations for significant gaps', () => {
    const attribution = {
      stock_selection: 40,
      timing: 30,
      position_sizing: 20,
      risk_management: 10
    }

    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const recommendations = generateRecommendations(attribution, current, target)

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.some(r => r.includes('stock selection'))).toBe(true)
    expect(recommendations.some(r => r.includes('timing'))).toBe(true)
  })

  it('should skip recommendations for minor factors', () => {
    const attribution = {
      stock_selection: 70,
      timing: 20,
      position_sizing: 5,
      risk_management: 5
    }

    const current: PerformanceMetrics = {
      total_return: 5,
      win_rate: 0.5,
      avg_profit: 8,
      avg_loss: -6,
      max_drawdown: 15
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const recommendations = generateRecommendations(attribution, current, target)

    // Should focus on major factors (stock_selection, timing)
    // Should not include minor factors (position_sizing, risk_management < 15%)
    expect(recommendations.some(r => r.includes('stock selection'))).toBe(true)
    expect(recommendations.some(r => r.includes('position sizing'))).toBe(false)
  })

  it('should provide general recommendation when performance is close', () => {
    const attribution = {
      stock_selection: 25,
      timing: 25,
      position_sizing: 25,
      risk_management: 25
    }

    const current: PerformanceMetrics = {
      total_return: 9.5,
      win_rate: 0.68,
      avg_profit: 9.5,
      avg_loss: -4.2,
      max_drawdown: 10.5
    }

    const target: PerformanceMetrics = {
      total_return: 10,
      win_rate: 0.7,
      avg_profit: 10,
      avg_loss: -4,
      max_drawdown: 10
    }

    const recommendations = generateRecommendations(attribution, current, target)

    // When all factors are below 15%, should get general recommendation
    expect(recommendations.length).toBeGreaterThan(0)
  })
})
