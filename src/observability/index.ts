import { registerFunctionHook } from '../hooks/index.js'
import { getSessionId, getWorkDir, getWorkspaceDir } from '../bootstrap/state.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { initLogger, appendEvent, getLogFilePath, getHtmlFilePath } from './logger.js'
import { generateReport } from './htmlReport.js'

const MAX_FIELD_LEN = 2000

function trunc(s: string): string {
  return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN) : s
}

// Per-tool start timestamps for duration computation.
// Tool calls may be parallel, so we use a stack per tool name.
const toolStartTs = new Map<string, number[]>()

export function initObservability(): void {
  const sessionId = getSessionId()
  const cwd = getWorkDir()
  initLogger(sessionId, cwd)

  // SessionStart — capture system prompt and log session_start event
  registerFunctionHook('SessionStart', async () => {
    try {
      const systemPrompt = await getSystemPrompt({
        cwd: getWorkDir(),
        sessionId: getSessionId(),
        workspaceDir: getWorkspaceDir(),
        isPlanMode: false,
      })
      await appendEvent({
        event: 'session_start',
        session_id: sessionId,
        cwd,
        system_prompt: trunc(systemPrompt),
        ts: Date.now(),
      })
    } catch {
      // silent
    }
  })

  // UserPromptSubmit — start of a new turn
  registerFunctionHook('UserPromptSubmit', async (input) => {
    if (input.hook_event_name !== 'UserPromptSubmit') return
    await appendEvent({
      event: 'user_prompt',
      prompt: trunc(input.prompt),
      ts: Date.now(),
    })
  })

  // PreToolUse — record tool call start
  registerFunctionHook('PreToolUse', async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return
    const ts = Date.now()
    const stack = toolStartTs.get(input.tool_name) ?? []
    stack.push(ts)
    toolStartTs.set(input.tool_name, stack)
    await appendEvent({
      event: 'tool_call',
      tool: input.tool_name,
      input: trunc(JSON.stringify(input.tool_input)),
      ts,
    })
  })

  // PostToolUse — record successful result + duration
  registerFunctionHook('PostToolUse', async (input) => {
    if (input.hook_event_name !== 'PostToolUse') return
    const ts = Date.now()
    const stack = toolStartTs.get(input.tool_name) ?? []
    const startTs = stack.shift() ?? ts
    if (stack.length === 0) toolStartTs.delete(input.tool_name)
    await appendEvent({
      event: 'tool_result',
      tool: input.tool_name,
      input: trunc(JSON.stringify(input.tool_input)),
      result: trunc(input.tool_response),
      duration_ms: ts - startTs,
      ts,
    })
  })

  // PostToolUseFailure — record error + duration
  registerFunctionHook('PostToolUseFailure', async (input) => {
    if (input.hook_event_name !== 'PostToolUseFailure') return
    const ts = Date.now()
    const stack = toolStartTs.get(input.tool_name) ?? []
    const startTs = stack.shift() ?? ts
    if (stack.length === 0) toolStartTs.delete(input.tool_name)
    await appendEvent({
      event: 'tool_error',
      tool: input.tool_name,
      input: trunc(JSON.stringify(input.tool_input)),
      error: trunc(input.tool_error),
      duration_ms: ts - startTs,
      ts,
    })
  })

  // Stop — record session_end with full messages[], then generate HTML report
  registerFunctionHook('Stop', async (input) => {
    if (input.hook_event_name !== 'Stop') return
    try {
      await appendEvent({
        event: 'session_end',
        stop_reason: input.stop_reason,
        messages: input.messages ?? [],
        ts: Date.now(),
      })
      const jsonlPath = getLogFilePath()
      const htmlPath = getHtmlFilePath()
      if (jsonlPath && htmlPath) {
        await generateReport(jsonlPath, htmlPath)
      }
    } catch {
      // silent — JSONL file preserved even if HTML fails
    }
  })
}
