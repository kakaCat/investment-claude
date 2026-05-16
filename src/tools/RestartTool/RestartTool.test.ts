import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RestartTool } from './RestartTool.js'
import * as restartModule from '../../utils/restart.js'

// Mock the restart module
vi.mock('../../utils/restart.js', () => ({
  performRestart: vi.fn().mockResolvedValue(undefined)
}))

describe('RestartTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should have correct tool definition', () => {
    expect(RestartTool.name).toBe('restart_agent')
    expect(RestartTool.description).toContain('Restart the entire agent process')
    expect(RestartTool.inputSchema.type).toBe('object')
    expect(RestartTool.inputSchema.properties).toHaveProperty('preserve_context')
  })

  it('should call performRestart with preserve_context=true by default', async () => {
    const mockContext = {
      abortSignal: new AbortController().signal,
      cwd: '/test',
      tools: [],
      getAppState: vi.fn(),
      setAppState: vi.fn()
    }

    const result = await RestartTool.call({}, mockContext as any)

    expect(restartModule.performRestart).toHaveBeenCalledWith(true)
    expect(result.data).toMatchObject({
      message: expect.stringContaining('重启'),
      preserve_context: true,
      estimated_time: expect.any(String)
    })
  })

  it('should call performRestart with preserve_context=false when specified', async () => {
    const mockContext = {
      abortSignal: new AbortController().signal,
      cwd: '/test',
      tools: [],
      getAppState: vi.fn(),
      setAppState: vi.fn()
    }

    const result = await RestartTool.call(
      { preserve_context: false },
      mockContext as any
    )

    expect(restartModule.performRestart).toHaveBeenCalledWith(false)
    expect(result.data).toMatchObject({
      message: expect.stringContaining('重启'),
      preserve_context: false,
      estimated_time: expect.any(String)
    })
  })

  it('should generate correct tool result block', () => {
    const output = {
      message: '🔄 Agent 重启中...',
      preserve_context: true,
      estimated_time: '10-30秒'
    }

    const block = RestartTool.mapToolResultToToolResultBlockParam(output, 'test-id')

    expect(block.type).toBe('tool_result')
    expect(block.tool_use_id).toBe('test-id')
    expect(block.content).toContain('重启')
    expect(block.content).toContain('对话上下文已保存')
  })

  it('should generate correct tool result block for clean restart', () => {
    const output = {
      message: '🔄 Agent 重启中...',
      preserve_context: false,
      estimated_time: '10-30秒'
    }

    const block = RestartTool.mapToolResultToToolResultBlockParam(output, 'test-id')

    expect(block.type).toBe('tool_result')
    expect(block.tool_use_id).toBe('test-id')
    expect(block.content).toContain('干净重启')
    expect(block.content).not.toContain('对话上下文已保存')
  })

  it('should be a non-readonly tool', () => {
    expect(RestartTool.isReadOnly()).toBe(false)
  })

  it('should be enabled by default', () => {
    expect(RestartTool.isEnabled()).toBe(true)
  })
})
