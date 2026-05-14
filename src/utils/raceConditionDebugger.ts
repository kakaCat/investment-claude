/**
 * Race Condition Debugger
 *
 * Utility to help identify and debug race conditions in tool execution.
 * Tracks tool execution timing, result mapping, and potential mismatches.
 */

import type { ToolUseContent } from '../types/message.js'

type ToolExecutionTrace = {
  toolUseId: string
  toolName: string
  startTime: number
  endTime?: number
  duration?: number
  resultStored: boolean
  resultRetrieved: boolean
}

class RaceConditionDebugger {
  private traces: Map<string, ToolExecutionTrace> = new Map()
  private enabled: boolean = false

  constructor() {
    this.enabled = process.env.DEBUG_RACE_CONDITION === 'true'
  }

  /**
   * Record the start of a tool execution
   */
  recordToolStart(toolUseId: string, toolName: string): void {
    if (!this.enabled) return

    this.traces.set(toolUseId, {
      toolUseId,
      toolName,
      startTime: Date.now(),
      resultStored: false,
      resultRetrieved: false
    })

    console.debug(`[RaceDebug] Tool started: ${toolName} (${toolUseId})`)
  }

  /**
   * Record the completion of a tool execution
   */
  recordToolEnd(toolUseId: string): void {
    if (!this.enabled) return

    const trace = this.traces.get(toolUseId)
    if (!trace) {
      console.warn(`[RaceDebug] No trace found for tool_use_id: ${toolUseId}`)
      return
    }

    trace.endTime = Date.now()
    trace.duration = trace.endTime - trace.startTime

    console.debug(`[RaceDebug] Tool completed: ${trace.toolName} (${toolUseId}) - ${trace.duration}ms`)
  }

  /**
   * Record when a tool result is stored
   */
  recordResultStored(toolUseId: string, output: unknown): void {
    if (!this.enabled) return

    const trace = this.traces.get(toolUseId)
    if (!trace) {
      console.warn(`[RaceDebug] Storing result for unknown tool_use_id: ${toolUseId}`)
      return
    }

    trace.resultStored = true
    console.debug(`[RaceDebug] Result stored: ${trace.toolName} (${toolUseId})`, {
      outputPreview: JSON.stringify(output).slice(0, 100)
    })
  }

  /**
   * Record when a tool result is retrieved for rendering
   */
  recordResultRetrieved(toolUseId: string, output: unknown): void {
    if (!this.enabled) return

    const trace = this.traces.get(toolUseId)
    if (!trace) {
      console.warn(`[RaceDebug] Retrieving result for unknown tool_use_id: ${toolUseId}`)
      return
    }

    trace.resultRetrieved = true
    console.debug(`[RaceDebug] Result retrieved: ${trace.toolName} (${toolUseId})`, {
      outputPreview: JSON.stringify(output).slice(0, 100)
    })
  }

  /**
   * Verify that all tool results were correctly stored and retrieved
   */
  verifyIntegrity(toolUses: ToolUseContent[], toolResults: Record<string, unknown>): void {
    if (!this.enabled) return

    console.debug('[RaceDebug] Verifying result integrity...')

    // Check for missing results
    for (const toolUse of toolUses) {
      if (!(toolUse.id in toolResults)) {
        console.error(`[RaceDebug] ✗ Missing result for tool_use_id: ${toolUse.id} (${toolUse.name})`)
      } else {
        console.debug(`[RaceDebug] ✓ Result found for: ${toolUse.id} (${toolUse.name})`)
      }
    }

    // Check for unexpected results
    for (const toolUseId of Object.keys(toolResults)) {
      if (!toolUses.find(t => t.id === toolUseId)) {
        console.error(`[RaceDebug] ✗ Unexpected result for tool_use_id: ${toolUseId}`)
      }
    }

    // Check for traces without stored results
    for (const [toolUseId, trace] of this.traces.entries()) {
      if (!trace.resultStored) {
        console.warn(`[RaceDebug] ⚠ Tool executed but result not stored: ${trace.toolName} (${toolUseId})`)
      }
      if (trace.resultStored && !trace.resultRetrieved) {
        console.warn(`[RaceDebug] ⚠ Result stored but not retrieved: ${trace.toolName} (${toolUseId})`)
      }
    }
  }

  /**
   * Detect potential race conditions based on execution timing
   */
  detectRaceConditions(): void {
    if (!this.enabled) return

    const traces = Array.from(this.traces.values())

    // Sort by start time
    traces.sort((a, b) => a.startTime - b.startTime)

    console.debug('[RaceDebug] Execution timeline:')
    for (const trace of traces) {
      const status = trace.resultStored && trace.resultRetrieved ? '✓' : '✗'
      console.debug(`  ${status} ${trace.toolName} (${trace.toolUseId}): ${trace.duration}ms`)
    }

    // Check for overlapping executions
    for (let i = 0; i < traces.length - 1; i++) {
      const current = traces[i]
      const next = traces[i + 1]

      if (!current.endTime || !next.startTime) continue

      if (next.startTime < current.endTime) {
        console.debug(`[RaceDebug] ⚠ Concurrent execution detected:`)
        console.debug(`    ${current.toolName} (${current.toolUseId})`)
        console.debug(`    ${next.toolName} (${next.toolUseId})`)
        console.debug(`    Overlap: ${current.endTime - next.startTime}ms`)
      }
    }
  }

  /**
   * Generate a summary report
   */
  generateReport(): string {
    if (!this.enabled) return 'Race condition debugging is disabled'

    const traces = Array.from(this.traces.values())
    const totalTools = traces.length
    const completedTools = traces.filter(t => t.endTime).length
    const storedResults = traces.filter(t => t.resultStored).length
    const retrievedResults = traces.filter(t => t.resultRetrieved).length

    const avgDuration = traces
      .filter(t => t.duration)
      .reduce((sum, t) => sum + t.duration!, 0) / completedTools

    return `
Race Condition Debug Report
===========================
Total tools executed: ${totalTools}
Completed: ${completedTools}
Results stored: ${storedResults}
Results retrieved: ${retrievedResults}
Average duration: ${avgDuration.toFixed(2)}ms

Integrity: ${storedResults === totalTools && retrievedResults === totalTools ? '✓ PASS' : '✗ FAIL'}
    `.trim()
  }

  /**
   * Clear all traces (call between test runs)
   */
  clear(): void {
    this.traces.clear()
  }
}

// Singleton instance
export const raceDebugger = new RaceConditionDebugger()

/**
 * Helper to enable debugging for a specific code block
 */
export function withRaceDebugging<T>(fn: () => T): T {
  const wasEnabled = process.env.DEBUG_RACE_CONDITION
  process.env.DEBUG_RACE_CONDITION = 'true'

  try {
    return fn()
  } finally {
    if (wasEnabled) {
      process.env.DEBUG_RACE_CONDITION = wasEnabled
    } else {
      delete process.env.DEBUG_RACE_CONDITION
    }
  }
}
