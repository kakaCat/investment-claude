/**
 * Intelligence Services Types
 *
 * Core type definitions for the evolution system that enables
 * continuous performance improvement through gap analysis and
 * automated strategy adjustments.
 */

/**
 * Performance metrics for evaluating trading strategy effectiveness
 */
export interface PerformanceMetrics {
  total_return: number
  win_rate: number
  avg_profit: number
  avg_loss: number
  max_drawdown: number
  sharpe_ratio?: number
}

/**
 * Gap analysis result identifying performance differences and their causes
 */
export interface GapAnalysis {
  performance_gap: number
  attribution: {
    stock_selection: number
    timing: number
    position_sizing: number
    risk_management: number
  }
  recommendations: string[]
}

/**
 * Evolution report documenting analysis results and actions taken
 */
export interface EvolutionReport {
  timestamp: string
  period: { start: string; end: string }
  current_performance: PerformanceMetrics
  target_performance: PerformanceMetrics
  gap_analysis: GapAnalysis
  actions_taken: string[]
  status: 'success' | 'partial' | 'failed'
}

/**
 * Trade record for historical performance analysis
 */
export interface TradeRecord {
  symbol: string
  name: string
  entry_date: string
  entry_price: number
  exit_date?: string
  exit_price?: number
  quantity: number
  profit?: number
  profit_rate?: number
  notes?: string
}
