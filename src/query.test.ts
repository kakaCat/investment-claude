import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  streamMock: vi.fn(),
  executeHooksMock: vi.fn(),
  initTaskStoreMock: vi.fn(),
  autoCompactIfNeededMock: vi.fn(),
  getAppStateMock: vi.fn(),
  setAppStateMock: vi.fn(),
  buildTodoReminderIfNeededMock: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = {
      stream: mocks.streamMock,
    }
  },
}))

vi.mock('./hooks/index.js', () => ({
  executeHooks: mocks.executeHooksMock,
}))

vi.mock('./tasks/taskFileStore.js', () => ({
  initTaskStore: mocks.initTaskStoreMock,
}))

vi.mock('./compact/autoCompact.js', () => ({
  autoCompactIfNeeded: mocks.autoCompactIfNeededMock,
  createAutoCompactTracking: () => ({ consecutiveFailures: 0 }),
  getAutoCompactThreshold: () => 167_000,
}))

vi.mock('./state/AppState.js', () => ({
  getAppState: mocks.getAppStateMock,
  setAppState: mocks.setAppStateMock,
}))

vi.mock('./state/todoReminder.js', () => ({
  buildTodoReminderIfNeeded: mocks.buildTodoReminderIfNeededMock,
}))

import { query } from './query.js'
import type { Message, StreamEvent } from './types/message.js'
import type { Tool } from './Tool.js'

function createToolUseStream(toolId: string, toolName: string): AsyncIterable<unknown> {
  return createStream([
    { type: 'content_block_start', content_block: { type: 'tool_use', id: toolId, name: toolName } },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
    { type: 'message_stop' },
  ])
}

function createStream(chunks: unknown[]): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
}

async function collectEvents(generator: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = []
  for await (const event of generator) {
    events.push(event)
  }
  return events
}

function createTool(call: Tool['call'] = vi.fn(async () => ({ data: 'ok' }))): Tool {
  return {
    name: 'TestTool',
    description: 'test tool',
    inputSchema: { type: 'object' },
    isEnabled: () => true,
    isReadOnly: () => false,
    call,
    mapToolResultToToolResultBlockParam: (output, toolUseId) => ({
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output as string,
    }),
    renderToolUse: () => null,
    renderToolResult: () => null,
  }
}

describe('query hook integration', () => {
  const baseMessages: Message[] = [
    {
      type: 'user',
      content: [{ type: 'text', text: 'hello' }],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.initTaskStoreMock.mockResolvedValue(undefined)
    mocks.autoCompactIfNeededMock.mockResolvedValue({ wasCompacted: false, tracking: { consecutiveFailures: 0 } })
    mocks.executeHooksMock.mockResolvedValue({})
    mocks.getAppStateMock.mockReturnValue({
      todos: [],
      tasks: new Map(),
      nextTaskId: 1,
    })
    mocks.buildTodoReminderIfNeededMock.mockReturnValue(undefined)
  })

  it('fires PreToolUse and PermissionDenied hooks before canUseTool on hook denial', async () => {
    mocks.streamMock
      .mockReturnValueOnce(createToolUseStream('tool-1', 'TestTool'))
      .mockReturnValueOnce(createStream([]))

    mocks.executeHooksMock.mockImplementation(async (input: { hook_event_name: string }) => {
      if (input.hook_event_name === 'PreToolUse') {
        return { permissionDecision: 'deny' as const, preventContinuation: true }
      }
      return {}
    })

    const canUseTool = vi.fn(async () => 'allow' as const)

    const events = await collectEvents(
      query({
        messages: baseMessages,
        tools: [createTool()],
        systemPrompt: 'system',
        canUseTool,
        maxTurns: 2,
        sessionId: 'session-123',
      }),
    )

    expect(canUseTool).not.toHaveBeenCalled()
    expect(events).toContainEqual({ type: 'tool_denied', tool_use_id: 'tool-1', name: 'TestTool' })

    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'PreToolUse',
        tool_name: 'TestTool',
        tool_input: {},
        session_id: 'session-123',
        cwd: process.cwd(),
      }),
      expect.objectContaining({ matcherQuery: 'TestTool' }),
    )

    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'PermissionDenied',
        tool_name: 'TestTool',
        tool_input: {},
        session_id: 'session-123',
        cwd: process.cwd(),
      }),
      expect.objectContaining({ matcherQuery: 'TestTool' }),
    )

    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'Stop',
        stop_reason: 'done',
        session_id: 'session-123',
        cwd: process.cwd(),
      }),
    )
  })

  it('fires PostToolUse after a successful tool call', async () => {
    const toolCall = vi.fn(async () => ({ data: 'tool ok' }))
    mocks.streamMock
      .mockReturnValueOnce(createToolUseStream('tool-1', 'TestTool'))
      .mockReturnValueOnce(createStream([]))

    const canUseTool = vi.fn(async () => 'allow' as const)

    await collectEvents(
      query({
        messages: baseMessages,
        tools: [createTool(toolCall)],
        systemPrompt: 'system',
        canUseTool,
        maxTurns: 2,
        sessionId: 'session-456',
      }),
    )

    expect(canUseTool).toHaveBeenCalledWith('TestTool', {})
    expect(toolCall).toHaveBeenCalledTimes(1)
    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'PostToolUse',
        tool_name: 'TestTool',
        tool_input: {},
        tool_response: 'tool ok',
        session_id: 'session-456',
        cwd: process.cwd(),
      }),
      expect.objectContaining({ matcherQuery: 'TestTool' }),
    )
  })

  it('fires PostToolUseFailure when a tool throws', async () => {
    mocks.streamMock
      .mockReturnValueOnce(createToolUseStream('tool-1', 'TestTool'))
      .mockReturnValueOnce(createStream([]))

    await collectEvents(
      query({
        messages: baseMessages,
        tools: [
          createTool(async () => {
            throw new Error('boom')
          }),
        ],
        systemPrompt: 'system',
        maxTurns: 2,
        sessionId: 'session-789',
      }),
    )

    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'TestTool',
        tool_input: {},
        tool_error: 'boom',
        session_id: 'session-789',
        cwd: process.cwd(),
      }),
      expect.objectContaining({ matcherQuery: 'TestTool' }),
    )
  })

  it('fires StopFailure when the stream fails', async () => {
    mocks.streamMock.mockReturnValueOnce({
      async *[Symbol.asyncIterator]() {
        throw new Error('stream failed')
      },
    })

    await collectEvents(
      query({
        messages: baseMessages,
        tools: [createTool()],
        systemPrompt: 'system',
        sessionId: 'session-error',
      }),
    )

    expect(mocks.executeHooksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'StopFailure',
        error: 'stream failed',
        session_id: 'session-error',
        cwd: process.cwd(),
      }),
    )
  })

})
