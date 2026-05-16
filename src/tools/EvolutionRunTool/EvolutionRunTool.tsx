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
        content: `❌ 进化分析失败: ${output.error || '未知错误'}`,
        is_error: true,
      }
    }

    const report = output.report
    const gap = report.gap_analysis
    const current = report.current_performance
    const target = report.target_performance

    // Format report for Claude with clear structure
    let content = `✅ 进化分析完成\n\n`
    content += `📅 分析周期: ${report.period.start} → ${report.period.end}\n`
    content += `📊 状态: ${report.status}\n\n`

    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    content += `📈 核心指标对比\n`
    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    content += `总收益率:   ${current.total_return.toFixed(2)}% / ${target.total_return.toFixed(2)}% (目标)\n`
    content += `胜率:       ${(current.win_rate * 100).toFixed(1)}% / ${(target.win_rate * 100).toFixed(1)}% (目标)\n`
    content += `平均盈利:   ${current.avg_profit.toFixed(2)}% / ${target.avg_profit.toFixed(2)}% (目标)\n`
    content += `最大回撤:   ${current.max_drawdown.toFixed(2)}% / ${target.max_drawdown.toFixed(2)}% (目标)\n`
    if (current.sharpe_ratio !== undefined && target.sharpe_ratio !== undefined) {
      content += `夏普比率:   ${current.sharpe_ratio.toFixed(2)} / ${target.sharpe_ratio.toFixed(2)} (目标)\n`
    }
    content += `\n`

    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    content += `🔍 差距归因分析\n`
    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    content += `总差距: ${gap.performance_gap.toFixed(2)}%\n\n`
    content += `归因分解:\n`
    content += `  • 选股问题: ${gap.attribution.stock_selection}% ${gap.attribution.stock_selection >= 30 ? '⚠️ 重点关注' : ''}\n`
    content += `  • 择时问题: ${gap.attribution.timing}% ${gap.attribution.timing >= 30 ? '⚠️ 重点关注' : ''}\n`
    content += `  • 仓位问题: ${gap.attribution.position_sizing}% ${gap.attribution.position_sizing >= 30 ? '⚠️ 重点关注' : ''}\n`
    content += `  • 风控问题: ${gap.attribution.risk_management}% ${gap.attribution.risk_management >= 30 ? '⚠️ 重点关注' : ''}\n`
    content += `\n`

    if (gap.recommendations.length > 0) {
      content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      content += `💡 优化建议 (${gap.recommendations.length} 条)\n`
      content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      gap.recommendations.slice(0, 5).forEach((rec, i) => {
        content += `${i + 1}. ${rec}\n`
      })
      if (gap.recommendations.length > 5) {
        content += `\n... 还有 ${gap.recommendations.length - 5} 条建议，详见完整报告\n`
      }
    }

    content += `\n📁 完整报告已保存至: .pi/evolution/reports/\n`

    if (report.actions_taken && report.actions_taken.length > 0) {
      content += `\n✅ 已执行操作:\n`
      report.actions_taken.forEach((action) => {
        content += `  • ${action}\n`
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
