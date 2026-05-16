import React from 'react'
import { Box, Text } from 'ink'
import { buildTool, type ToolResult, type ToolUseContext } from '../../Tool.js'
import { EVOLUTION_RUN_TOOL_DESCRIPTION } from './prompt.js'
import { runEvolution } from '../../services/intelligence/evolution-service.js'
import type { EvolutionReport } from '../../services/intelligence/types.js'
import type { PermissionDecision } from '../../permissions/types.js'

interface EvolutionRunInput {
  period_days?: number
  target_return?: number
  auto_apply?: boolean
}

type EvolutionRunOutput = {
  success: boolean
  report?: EvolutionReport
  error?: string
}

// ── Tool Integration Layer ──────────────────────────────────────────────────

async function execute(
  input: EvolutionRunInput,
  context: ToolUseContext,
): Promise<ToolResult<EvolutionRunOutput>> {
  try {
    // Calculate period from period_days
    const periodDays = input.period_days || 30
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - periodDays)

    const period = {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }

    // Run evolution analysis
    const report = await runEvolution({
      period,
      target_return: input.target_return,
      auto_apply: input.auto_apply,
    })

    return {
      data: {
        success: true,
        report,
      },
    }
  } catch (error) {
    return {
      data: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }
  }
}

function checkPermission(input: EvolutionRunInput): PermissionDecision {
  // Auto-apply requires user confirmation
  if (input.auto_apply) {
    return {
      behavior: 'ask',
      message: `Run evolution analysis and auto-apply recommendations?`,
    }
  }

  // Read-only analysis auto-approves
  return { behavior: 'allow' }
}

// ── UI Rendering ────────────────────────────────────────────────────────────

function renderToolResultMessage(
  result: EvolutionRunOutput,
  options: { verbose: boolean }
): React.ReactNode {
  // Error state
  if (!result.success || !result.report) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Evolution Run</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> ✗ Error: {result.error || 'Unknown error'}</Text>
        </Box>
      </Box>
    )
  }

  const report = result.report
  const gap = report.gap_analysis

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> Evolution Run</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Evolution analysis complete</Text>
      </Box>

      {/* Period Info */}
      <Box paddingLeft={5} marginTop={1} flexDirection="column">
        <Text color="cyan">
          Period: {report.period.start} to {report.period.end}
        </Text>
        <Text color="gray" dimColor>
          Status: {report.status}
        </Text>
      </Box>

      {/* Performance Metrics */}
      <Box paddingLeft={5} marginTop={1} flexDirection="column">
        <Text color="yellow">Performance Metrics:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="white">
            Total Return: {report.current_performance.total_return.toFixed(2)}%
            <Text color="gray"> (Target: {report.target_performance.total_return.toFixed(2)}%)</Text>
          </Text>
          <Text color="white">
            Win Rate: {(report.current_performance.win_rate * 100).toFixed(1)}%
            <Text color="gray"> (Target: {(report.target_performance.win_rate * 100).toFixed(1)}%)</Text>
          </Text>
          <Text color="white">
            Avg Profit: {report.current_performance.avg_profit.toFixed(2)}%
            <Text color="gray"> (Target: {report.target_performance.avg_profit.toFixed(2)}%)</Text>
          </Text>
          <Text color="white">
            Max Drawdown: {report.current_performance.max_drawdown.toFixed(2)}%
            <Text color="gray"> (Target: {report.target_performance.max_drawdown.toFixed(2)}%)</Text>
          </Text>
          {report.current_performance.sharpe_ratio !== undefined && (
            <Text color="white">
              Sharpe Ratio: {report.current_performance.sharpe_ratio.toFixed(2)}
              {report.target_performance.sharpe_ratio && (
                <Text color="gray"> (Target: {report.target_performance.sharpe_ratio.toFixed(2)})</Text>
              )}
            </Text>
          )}
        </Box>
      </Box>

      {/* Gap Analysis */}
      <Box paddingLeft={5} marginTop={1} flexDirection="column">
        <Text color="yellow">Gap Analysis:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="white">
            Performance Gap: {gap.performance_gap.toFixed(2)}%
          </Text>
          <Text color="cyan">Attribution:</Text>
          <Box paddingLeft={2} flexDirection="column">
            <Text color="gray">Stock Selection: {gap.attribution.stock_selection}%</Text>
            <Text color="gray">Timing: {gap.attribution.timing}%</Text>
            <Text color="gray">Position Sizing: {gap.attribution.position_sizing}%</Text>
            <Text color="gray">Risk Management: {gap.attribution.risk_management}%</Text>
          </Box>
        </Box>
      </Box>

      {/* Recommendations */}
      {gap.recommendations.length > 0 && (
        <Box paddingLeft={5} marginTop={1} flexDirection="column">
          <Text color="yellow">Recommendations ({gap.recommendations.length}):</Text>
          <Box paddingLeft={2} flexDirection="column">
            {gap.recommendations.slice(0, 5).map((rec, i) => (
              <Text key={i} color="white">
                {i + 1}. {rec}
              </Text>
            ))}
            {gap.recommendations.length > 5 && (
              <Text color="gray" dimColor>
                ... and {gap.recommendations.length - 5} more recommendations
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Actions Taken */}
      {report.actions_taken.length > 0 && (
        <Box paddingLeft={5} marginTop={1} flexDirection="column">
          <Text color="green">Actions Taken:</Text>
          <Box paddingLeft={2} flexDirection="column">
            {report.actions_taken.map((action, i) => (
              <Text key={i} color="gray">
                • {action}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ── Tool Definition ─────────────────────────────────────────────────────────

export const EvolutionRunTool = buildTool({
  name: 'evolution_run',
  description: EVOLUTION_RUN_TOOL_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      period_days: {
        type: 'number',
        description: 'Analysis period in days (default 30)',
        default: 30,
      },
      target_return: {
        type: 'number',
        description: 'Target return percentage (default 20)',
        default: 20,
      },
      auto_apply: {
        type: 'boolean',
        description: 'Auto-apply recommendations (default false)',
        default: false,
      },
    },
  },
  isReadOnly: (input?: EvolutionRunInput) => !input?.auto_apply,
  checkPermissions: checkPermission,
  call: execute,
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (!output.success || !output.report) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `Evolution analysis failed: ${output.error || 'Unknown error'}`,
        is_error: true,
      }
    }

    const report = output.report
    const gap = report.gap_analysis

    // Format report for Claude
    let content = `Evolution Analysis Report\n\n`
    content += `Period: ${report.period.start} to ${report.period.end}\n`
    content += `Status: ${report.status}\n\n`

    content += `Performance Metrics:\n`
    content += `- Total Return: ${report.current_performance.total_return.toFixed(2)}% (Target: ${report.target_performance.total_return.toFixed(2)}%)\n`
    content += `- Win Rate: ${(report.current_performance.win_rate * 100).toFixed(1)}% (Target: ${(report.target_performance.win_rate * 100).toFixed(1)}%)\n`
    content += `- Avg Profit: ${report.current_performance.avg_profit.toFixed(2)}% (Target: ${report.target_performance.avg_profit.toFixed(2)}%)\n`
    content += `- Max Drawdown: ${report.current_performance.max_drawdown.toFixed(2)}% (Target: ${report.target_performance.max_drawdown.toFixed(2)}%)\n`
    if (report.current_performance.sharpe_ratio !== undefined) {
      content += `- Sharpe Ratio: ${report.current_performance.sharpe_ratio.toFixed(2)}`
      if (report.target_performance.sharpe_ratio) {
        content += ` (Target: ${report.target_performance.sharpe_ratio.toFixed(2)})`
      }
      content += `\n`
    }

    content += `\nGap Analysis:\n`
    content += `- Performance Gap: ${gap.performance_gap.toFixed(2)}%\n`
    content += `- Attribution:\n`
    content += `  - Stock Selection: ${gap.attribution.stock_selection}%\n`
    content += `  - Timing: ${gap.attribution.timing}%\n`
    content += `  - Position Sizing: ${gap.attribution.position_sizing}%\n`
    content += `  - Risk Management: ${gap.attribution.risk_management}%\n`

    if (gap.recommendations.length > 0) {
      content += `\nRecommendations:\n`
      gap.recommendations.forEach((rec, i) => {
        content += `${i + 1}. ${rec}\n`
      })
    }

    if (report.actions_taken.length > 0) {
      content += `\nActions Taken:\n`
      report.actions_taken.forEach((action) => {
        content += `- ${action}\n`
      })
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content,
    }
  },
  renderToolResultMessage(output, options) {
    return renderToolResultMessage(output, { verbose: options.verbose })
  },
})

export { execute as runEvolutionTool }
