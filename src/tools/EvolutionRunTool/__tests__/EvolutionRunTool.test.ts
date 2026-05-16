import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EvolutionRunTool, runEvolutionTool } from '../EvolutionRunTool.js'
import * as evolutionService from '../../../services/intelligence/evolution-service.js'
import type { EvolutionReport } from '../../../services/intelligence/types.js'
import type { ToolUseContext } from '../../../Tool.js'

// Mock the evolution service
vi.mock('../../../services/intelligence/evolution-service.js', () => ({
  runEvolution: vi.fn(),
}))

describe('EvolutionRunTool', () => {
  const mockContext: ToolUseContext = {
    cwd: '/test/cwd',
    verbose: false,
  } as any

  const mockReport: EvolutionReport = {
    timestamp: '2026-05-16T10:00:00.000Z',
    period: {
      start: '2026-04-16',
      end: '2026-05-16',
    },
    current_performance: {
      total_return: 15.5,
      win_rate: 0.55,
      avg_profit: 0.23,
      avg_loss: -0.12,
      max_drawdown: 8.5,
      sharpe_ratio: 1.2,
    },
    target_performance: {
      total_return: 20,
      win_rate: 0.6,
      avg_profit: 0.3,
      avg_loss: -0.16,
      max_drawdown: 6,
      sharpe_ratio: 1.5,
    },
    gap_analysis: {
      performance_gap: 4.5,
      attribution: {
        stock_selection: 30,
        timing: 25,
        position_sizing: 25,
        risk_management: 20,
      },
      recommendations: [
        'Improve stock selection criteria',
        'Optimize entry timing',
        'Adjust position sizing strategy',
      ],
    },
    actions_taken: [],
    status: 'success',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(EvolutionRunTool.name).toBe('evolution_run')
    })

    it('should have description', () => {
      expect(EvolutionRunTool.description).toBeDefined()
      expect(EvolutionRunTool.description.length).toBeGreaterThan(0)
    })

    it('should have correct input schema', () => {
      expect(EvolutionRunTool.inputSchema).toBeDefined()
      expect(EvolutionRunTool.inputSchema.type).toBe('object')
      expect(EvolutionRunTool.inputSchema.properties).toHaveProperty('period_days')
      expect(EvolutionRunTool.inputSchema.properties).toHaveProperty('target_return')
      expect(EvolutionRunTool.inputSchema.properties).toHaveProperty('auto_apply')
    })
  })

  describe('execute', () => {
    it('should run evolution with default parameters', async () => {
      vi.mocked(evolutionService.runEvolution).mockResolvedValue(mockReport)

      const result = await runEvolutionTool({}, mockContext)

      expect(result.data.success).toBe(true)
      expect(result.data.report).toEqual(mockReport)
      expect(evolutionService.runEvolution).toHaveBeenCalledWith(
        expect.objectContaining({
          period: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String),
          }),
          target_return: undefined,
          auto_apply: undefined,
        })
      )
    })

    it('should run evolution with custom period_days', async () => {
      vi.mocked(evolutionService.runEvolution).mockResolvedValue(mockReport)

      const result = await runEvolutionTool(
        { period_days: 60 },
        mockContext
      )

      expect(result.data.success).toBe(true)
      expect(evolutionService.runEvolution).toHaveBeenCalledWith(
        expect.objectContaining({
          period: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String),
          }),
        })
      )

      // Verify period is approximately 60 days
      const calls = vi.mocked(evolutionService.runEvolution).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const callArg = calls[0]?.[0]
      expect(callArg).toBeDefined()
      if (callArg?.period) {
        const start = new Date(callArg.period.start)
        const end = new Date(callArg.period.end)
        const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        expect(daysDiff).toBe(60)
      }
    })

    it('should run evolution with custom target_return', async () => {
      vi.mocked(evolutionService.runEvolution).mockResolvedValue(mockReport)

      const result = await runEvolutionTool(
        { target_return: 25 },
        mockContext
      )

      expect(result.data.success).toBe(true)
      expect(evolutionService.runEvolution).toHaveBeenCalledWith(
        expect.objectContaining({
          target_return: 25,
        })
      )
    })

    it('should run evolution with auto_apply enabled', async () => {
      const reportWithActions = {
        ...mockReport,
        actions_taken: ['Saved 3 recommendations to pending actions'],
      }
      vi.mocked(evolutionService.runEvolution).mockResolvedValue(reportWithActions)

      const result = await runEvolutionTool(
        { auto_apply: true },
        mockContext
      )

      expect(result.data.success).toBe(true)
      expect(result.data.report?.actions_taken).toHaveLength(1)
      expect(evolutionService.runEvolution).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_apply: true,
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const errorMessage = 'Failed to load trades'
      vi.mocked(evolutionService.runEvolution).mockRejectedValue(
        new Error(errorMessage)
      )

      const result = await runEvolutionTool({}, mockContext)

      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe(errorMessage)
      expect(result.data.report).toBeUndefined()
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(evolutionService.runEvolution).mockRejectedValue('String error')

      const result = await runEvolutionTool({}, mockContext)

      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('Unknown error occurred')
    })
  })

  describe('checkPermissions', () => {
    it('should allow read-only analysis without confirmation', () => {
      const permission = EvolutionRunTool.checkPermissions?.({})

      expect(permission).toEqual({ behavior: 'allow' })
    })

    it('should ask for confirmation when auto_apply is enabled', () => {
      const permission = EvolutionRunTool.checkPermissions?.({ auto_apply: true })

      expect(permission).toEqual({
        behavior: 'ask',
        message: 'Run evolution analysis and auto-apply recommendations?',
      })
    })

    it('should allow when auto_apply is false', () => {
      const permission = EvolutionRunTool.checkPermissions?.({ auto_apply: false })

      expect(permission).toEqual({ behavior: 'allow' })
    })
  })

  describe('isReadOnly', () => {
    it('should be read-only when auto_apply is false', () => {
      const isReadOnly = EvolutionRunTool.isReadOnly()
      expect(typeof isReadOnly).toBe('boolean')
    })

    it('should be read-only by default', () => {
      const isReadOnly = EvolutionRunTool.isReadOnly()
      expect(typeof isReadOnly).toBe('boolean')
    })
  })

  describe('mapToolResultToToolResultBlockParam', () => {
    it('should format successful result for Claude', () => {
      const result = EvolutionRunTool.mapToolResultToToolResultBlockParam(
        { success: true, report: mockReport },
        'test-tool-use-id'
      )

      expect(result.type).toBe('tool_result')
      expect(result.tool_use_id).toBe('test-tool-use-id')
      expect(result.content).toContain('Evolution Analysis Report')
      expect(result.content).toContain('Total Return: 15.50%')
      expect(result.content).toContain('Performance Gap: 4.50%')
      expect(result.content).toContain('Improve stock selection criteria')
      expect(result).not.toHaveProperty('is_error')
    })

    it('should format error result for Claude', () => {
      const result = EvolutionRunTool.mapToolResultToToolResultBlockParam(
        { success: false, error: 'Test error' },
        'test-tool-use-id'
      )

      expect(result.type).toBe('tool_result')
      expect(result.tool_use_id).toBe('test-tool-use-id')
      expect(result.content).toContain('Evolution analysis failed')
      expect(result.content).toContain('Test error')
      expect(result.is_error).toBe(true)
    })

    it('should include actions taken when present', () => {
      const reportWithActions = {
        ...mockReport,
        actions_taken: ['Saved 3 recommendations to pending actions'],
      }

      const result = EvolutionRunTool.mapToolResultToToolResultBlockParam(
        { success: true, report: reportWithActions },
        'test-tool-use-id'
      )

      expect(result.content).toContain('Actions Taken:')
      expect(result.content).toContain('Saved 3 recommendations to pending actions')
    })

    it('should handle missing sharpe_ratio', () => {
      const reportWithoutSharpe = {
        ...mockReport,
        current_performance: {
          ...mockReport.current_performance,
          sharpe_ratio: undefined,
        },
      }

      const result = EvolutionRunTool.mapToolResultToToolResultBlockParam(
        { success: true, report: reportWithoutSharpe },
        'test-tool-use-id'
      )

      expect(result.content).not.toContain('Sharpe Ratio')
    })
  })
})
