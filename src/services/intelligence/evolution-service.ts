/**
 * Evolution Service - Main Orchestrator for Evolution Cycle
 *
 * Coordinates the complete evolution workflow:
 * 1. Data collection from trade logs
 * 2. Performance analysis using comparator
 * 3. Gap analysis and recommendations
 * 4. Report generation and persistence
 * 5. Optional auto-apply of recommendations
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { calculatePerformanceMetrics, calculateGap } from './comparator'
import type {
  PerformanceMetrics,
  EvolutionReport,
  TradeRecord
} from './types'

/**
 * Options for running evolution analysis
 */
export interface EvolutionOptions {
  /** Analysis period (default: last 30 days) */
  period?: {
    start: string
    end: string
  }
  /** Target return percentage (default: 20%) */
  target_return?: number
  /** Auto-apply recommendations (default: false) */
  auto_apply?: boolean
}

/**
 * Main evolution orchestrator
 * Runs complete evolution cycle and returns analysis report
 */
export async function runEvolution(options: EvolutionOptions = {}): Promise<EvolutionReport> {
  const timestamp = new Date().toISOString()

  try {
    // Step 1: Define analysis period
    const period = options.period || getDefaultPeriod()

    // Step 2: Load and filter trades
    const trades = await loadTrades(period)

    // Step 3: Calculate current performance
    const currentPerformance = calculatePerformanceMetrics(trades)

    // Step 4: Define target performance
    const targetPerformance = defineTargetPerformance(options.target_return || 20)

    // Step 5: Calculate gap and get recommendations
    const gapAnalysis = calculateGap(currentPerformance, targetPerformance)

    // Step 6: Handle auto-apply if enabled
    const actionsTaken: string[] = []
    if (options.auto_apply && gapAnalysis.recommendations.length > 0) {
      await saveActions(gapAnalysis.recommendations)
      actionsTaken.push(`Saved ${gapAnalysis.recommendations.length} recommendations to pending actions`)
    }

    // Step 7: Create evolution report
    const report: EvolutionReport = {
      timestamp,
      period,
      current_performance: currentPerformance,
      target_performance: targetPerformance,
      gap_analysis: gapAnalysis,
      actions_taken: actionsTaken,
      status: 'success'
    }

    // Step 8: Save report
    await saveReport(report)

    return report

  } catch (error) {
    // Handle errors gracefully, return partial results
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Create minimal report on failure
    const failedReport: EvolutionReport = {
      timestamp,
      period: options.period || getDefaultPeriod(),
      current_performance: {
        total_return: 0,
        win_rate: 0,
        avg_profit: 0,
        avg_loss: 0,
        max_drawdown: 0,
        sharpe_ratio: 0
      },
      target_performance: defineTargetPerformance(options.target_return || 20),
      gap_analysis: {
        performance_gap: 0,
        attribution: {
          stock_selection: 25,
          timing: 25,
          position_sizing: 25,
          risk_management: 25
        },
        recommendations: [`Evolution failed: ${errorMessage}`]
      },
      actions_taken: [],
      status: 'failed'
    }

    // Try to save failed report
    try {
      await saveReport(failedReport)
    } catch {
      // Ignore save errors for failed reports
    }

    return failedReport
  }
}

/**
 * Load trades from trade log directory, filtered by period
 */
export async function loadTrades(period?: { start: string; end: string }): Promise<TradeRecord[]> {
  const tradeLogDir = path.join(process.cwd(), '.pi', 'trade-log')

  try {
    // Check if directory exists
    await fs.access(tradeLogDir)
  } catch {
    // Directory doesn't exist, return empty array
    console.warn(`Trade log directory not found: ${tradeLogDir}`)
    return []
  }

  try {
    // Look for JSON files in trade-log directory
    const files = await fs.readdir(tradeLogDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    if (jsonFiles.length === 0) {
      console.warn('No JSON trade log files found')
      return []
    }

    // Load all trade records
    const allTrades: TradeRecord[] = []

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(tradeLogDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)

        // Handle both single trade and array of trades
        const trades = Array.isArray(data) ? data : [data]
        allTrades.push(...trades)
      } catch (error) {
        console.warn(`Failed to load trade file ${file}:`, error)
        // Continue with other files
      }
    }

    // Filter by period if specified
    if (period) {
      return allTrades.filter(trade => {
        const tradeDate = trade.exit_date || trade.entry_date
        return tradeDate >= period.start && tradeDate <= period.end
      })
    }

    return allTrades

  } catch (error) {
    console.error('Error loading trades:', error)
    return []
  }
}

/**
 * Define target performance metrics based on target return
 */
export function defineTargetPerformance(targetReturn: number): PerformanceMetrics {
  // Define realistic target metrics based on target return
  // These are industry-standard benchmarks for good trading performance
  return {
    total_return: targetReturn,
    win_rate: 0.6, // 60% win rate is a good target
    avg_profit: targetReturn * 0.015, // Average profit per winning trade
    avg_loss: -targetReturn * 0.008, // Average loss per losing trade (smaller than profit)
    max_drawdown: targetReturn * 0.3, // Max drawdown should be ~30% of target return
    sharpe_ratio: 1.5 // Sharpe ratio > 1.5 is considered good
  }
}

/**
 * Get default analysis period (last 30 days)
 */
function getDefaultPeriod(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

/**
 * Save evolution report to file system
 */
export async function saveReport(report: EvolutionReport): Promise<void> {
  const reportsDir = path.join(process.cwd(), '.pi', 'evolution', 'reports')

  // Ensure directory exists
  await fs.mkdir(reportsDir, { recursive: true })

  // Generate filename with timestamp
  const timestamp = new Date(report.timestamp)
  const filename = `${timestamp.toISOString().split('T')[0]}-${timestamp.toTimeString().split(' ')[0].replace(/:/g, '')}.json`
  const filePath = path.join(reportsDir, filename)

  // Save report
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8')

  console.log(`Evolution report saved: ${filePath}`)
}

/**
 * Save recommendations to pending actions file
 */
export async function saveActions(recommendations: string[]): Promise<void> {
  const actionsDir = path.join(process.cwd(), '.pi', 'evolution', 'actions')

  // Ensure directory exists
  await fs.mkdir(actionsDir, { recursive: true })

  const filePath = path.join(actionsDir, 'pending.json')

  // Create actions object
  const actions = {
    timestamp: new Date().toISOString(),
    recommendations,
    status: 'pending'
  }

  // Save actions
  await fs.writeFile(filePath, JSON.stringify(actions, null, 2), 'utf-8')

  console.log(`Pending actions saved: ${filePath}`)
}

/**
 * Get latest evolution report
 */
export async function getLatestReport(): Promise<EvolutionReport | null> {
  const reportsDir = path.join(process.cwd(), '.pi', 'evolution', 'reports')

  try {
    const files = await fs.readdir(reportsDir)
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse()

    if (jsonFiles.length === 0) {
      return null
    }

    const latestFile = path.join(reportsDir, jsonFiles[0])
    const content = await fs.readFile(latestFile, 'utf-8')
    return JSON.parse(content)

  } catch {
    return null
  }
}
