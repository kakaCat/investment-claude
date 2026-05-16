/**
 * Comparator - Performance Gap Calculator
 *
 * Analyzes performance gaps between current and target metrics,
 * performs attribution analysis, and generates actionable recommendations.
 */

import type { PerformanceMetrics, GapAnalysis, TradeRecord } from './types'

/**
 * Calculate performance metrics from trade records
 */
export function calculatePerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  // Handle empty trades
  if (trades.length === 0) {
    return {
      total_return: 0,
      win_rate: 0,
      avg_profit: 0,
      avg_loss: 0,
      max_drawdown: 0,
      sharpe_ratio: 0
    }
  }

  // Filter completed trades (with exit price and profit_rate)
  const completedTrades = trades.filter(t => t.exit_price !== undefined && t.profit_rate !== undefined)

  if (completedTrades.length === 0) {
    return {
      total_return: 0,
      win_rate: 0,
      avg_profit: 0,
      avg_loss: 0,
      max_drawdown: 0,
      sharpe_ratio: 0
    }
  }

  // Calculate total return (average of all profit rates)
  const totalReturn = completedTrades.reduce((sum, t) => sum + (t.profit_rate || 0), 0) / completedTrades.length

  // Calculate win rate
  const winningTrades = completedTrades.filter(t => (t.profit_rate || 0) > 0)
  const winRate = winningTrades.length / completedTrades.length

  // Calculate average profit (only winning trades)
  const avgProfit = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.profit_rate || 0), 0) / winningTrades.length
    : 0

  // Calculate average loss (only losing trades)
  const losingTrades = completedTrades.filter(t => (t.profit_rate || 0) < 0)
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + (t.profit_rate || 0), 0) / losingTrades.length
    : 0

  // Calculate max drawdown
  const maxDrawdown = calculateMaxDrawdown(completedTrades)

  // Calculate Sharpe ratio (simplified: return / std_dev)
  const sharpeRatio = calculateSharpeRatio(completedTrades)

  return {
    total_return: totalReturn,
    win_rate: winRate,
    avg_profit: avgProfit,
    avg_loss: avgLoss,
    max_drawdown: maxDrawdown,
    sharpe_ratio: sharpeRatio
  }
}

/**
 * Calculate maximum drawdown from trade records
 */
function calculateMaxDrawdown(trades: TradeRecord[]): number {
  if (trades.length === 0) return 0

  let peak = 0
  let maxDrawdown = 0
  let cumulative = 0

  // Sort trades by exit date
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = a.exit_date || a.entry_date
    const dateB = b.exit_date || b.entry_date
    return dateA.localeCompare(dateB)
  })

  for (const trade of sortedTrades) {
    cumulative += trade.profit_rate || 0

    if (cumulative > peak) {
      peak = cumulative
    }

    const drawdown = peak - cumulative
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown
}

/**
 * Calculate Sharpe ratio (simplified version)
 */
function calculateSharpeRatio(trades: TradeRecord[]): number {
  if (trades.length < 2) return 0

  const returns = trades.map(t => t.profit_rate || 0)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)

  // Avoid division by zero
  if (stdDev === 0) return 0

  // Simplified Sharpe ratio (assuming risk-free rate = 0)
  return avgReturn / stdDev
}

/**
 * Calculate performance gap and perform attribution analysis
 */
export function calculateGap(
  current: PerformanceMetrics,
  target: PerformanceMetrics
): GapAnalysis {
  // Calculate overall performance gap
  const performanceGap = target.total_return - current.total_return

  // Perform attribution analysis
  const attribution = {
    stock_selection: analyzeStockSelection(current, target),
    timing: analyzeTiming(current, target),
    position_sizing: analyzePositionSizing(current, target),
    risk_management: analyzeRiskManagement(current, target)
  }

  // Normalize attribution to sum to 100%
  const totalAttribution = Object.values(attribution).reduce((sum, val) => sum + val, 0)
  if (totalAttribution > 0) {
    attribution.stock_selection = (attribution.stock_selection / totalAttribution) * 100
    attribution.timing = (attribution.timing / totalAttribution) * 100
    attribution.position_sizing = (attribution.position_sizing / totalAttribution) * 100
    attribution.risk_management = (attribution.risk_management / totalAttribution) * 100
  } else {
    // When there's no gap, distribute evenly
    attribution.stock_selection = 25
    attribution.timing = 25
    attribution.position_sizing = 25
    attribution.risk_management = 25
  }

  // Generate recommendations based on attribution
  const recommendations = generateRecommendations(attribution, current, target)

  return {
    performance_gap: performanceGap,
    attribution,
    recommendations
  }
}

/**
 * Analyze stock selection contribution to gap
 * Based on win rate difference
 */
export function analyzeStockSelection(current: PerformanceMetrics, target: PerformanceMetrics): number {
  const winRateGap = Math.abs(target.win_rate - current.win_rate)
  // Win rate is a strong indicator of stock selection quality
  return winRateGap * 100
}

/**
 * Analyze timing contribution to gap
 * Based on profit/loss ratio
 */
export function analyzeTiming(current: PerformanceMetrics, target: PerformanceMetrics): number {
  // Calculate profit/loss ratio (how well we time entries/exits)
  const currentRatio = current.avg_loss !== 0 ? Math.abs(current.avg_profit / current.avg_loss) : 1
  const targetRatio = target.avg_loss !== 0 ? Math.abs(target.avg_profit / target.avg_loss) : 1

  const ratioGap = Math.abs(targetRatio - currentRatio)
  // Timing affects the profit/loss ratio
  return ratioGap * 50
}

/**
 * Analyze position sizing contribution to gap
 * Based on total return variance
 */
export function analyzePositionSizing(current: PerformanceMetrics, target: PerformanceMetrics): number {
  // Position sizing affects overall return magnitude
  const returnGap = Math.abs(target.total_return - current.total_return)
  // If win rate is good but returns are low, it's likely a position sizing issue
  const winRateOk = current.win_rate >= target.win_rate * 0.8
  return winRateOk ? returnGap * 2 : returnGap * 0.5
}

/**
 * Analyze risk management contribution to gap
 * Based on max drawdown difference
 */
export function analyzeRiskManagement(current: PerformanceMetrics, target: PerformanceMetrics): number {
  const drawdownGap = Math.abs(target.max_drawdown - current.max_drawdown)
  // Drawdown is a key risk management metric
  return drawdownGap
}

/**
 * Generate actionable recommendations based on attribution analysis
 */
export function generateRecommendations(
  attribution: { stock_selection: number; timing: number; position_sizing: number; risk_management: number },
  current: PerformanceMetrics,
  target: PerformanceMetrics
): string[] {
  const recommendations: string[] = []

  // Sort attribution by magnitude to prioritize recommendations
  const sortedAttribution = Object.entries(attribution)
    .sort(([, a], [, b]) => b - a)

  // Generate recommendations for top contributors
  for (const [factor, percentage] of sortedAttribution) {
    if (percentage < 15) continue // Only recommend for significant factors

    switch (factor) {
      case 'stock_selection':
        if (current.win_rate < target.win_rate) {
          recommendations.push(
            `Improve stock selection: Current win rate ${(current.win_rate * 100).toFixed(1)}% vs target ${(target.win_rate * 100).toFixed(1)}%. Consider stricter entry criteria or better fundamental analysis.`
          )
        }
        break

      case 'timing':
        const currentRatio = current.avg_loss !== 0 ? current.avg_profit / Math.abs(current.avg_loss) : 0
        const targetRatio = target.avg_loss !== 0 ? target.avg_profit / Math.abs(target.avg_loss) : 0
        if (currentRatio < targetRatio) {
          recommendations.push(
            `Optimize entry/exit timing: Current profit/loss ratio ${currentRatio.toFixed(2)} vs target ${targetRatio.toFixed(2)}. Review technical indicators and exit strategies.`
          )
        }
        break

      case 'position_sizing':
        if (current.total_return < target.total_return && current.win_rate >= target.win_rate * 0.8) {
          recommendations.push(
            `Adjust position sizing: Win rate is adequate but returns are low. Consider increasing position sizes on high-conviction trades.`
          )
        } else if (current.total_return < target.total_return) {
          recommendations.push(
            `Review position sizing strategy: Current return ${current.total_return.toFixed(2)}% vs target ${target.total_return.toFixed(2)}%. Balance risk and opportunity.`
          )
        }
        break

      case 'risk_management':
        if (current.max_drawdown > target.max_drawdown) {
          recommendations.push(
            `Strengthen risk management: Current max drawdown ${current.max_drawdown.toFixed(2)}% vs target ${target.max_drawdown.toFixed(2)}%. Implement stricter stop-losses and position limits.`
          )
        }
        break
    }
  }

  // Add general recommendation if no specific ones generated
  if (recommendations.length === 0) {
    recommendations.push(
      'Performance is close to target. Continue monitoring and maintain current strategy.'
    )
  }

  return recommendations
}
