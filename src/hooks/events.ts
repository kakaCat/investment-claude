export type HookExecutionEvent =
  | { type: 'started'; hookEvent: string; command: string }
  | { type: 'progress'; hookEvent: string; output: string }
  | {
      type: 'response'
      hookEvent: string
      outcome: 'success' | 'error' | 'cancelled'
      output: string
    }

const hookEventHandlers = new Set<(e: HookExecutionEvent) => void>()

export function registerHookEventHandler(handler: (e: HookExecutionEvent) => void): () => void {
  hookEventHandlers.add(handler)

  return () => {
    hookEventHandlers.delete(handler)
  }
}

export function emitHookStarted(hookEvent: string, command: string): void {
  emitHookEvent({
    type: 'started',
    hookEvent,
    command,
  })
}

export function emitHookProgress(hookEvent: string, output: string): void {
  emitHookEvent({
    type: 'progress',
    hookEvent,
    output,
  })
}

export function emitHookResponse(
  hookEvent: string,
  outcome: 'success' | 'error' | 'cancelled',
  output: string,
): void {
  emitHookEvent({
    type: 'response',
    hookEvent,
    outcome,
    output,
  })
}

export function clearHookEventHandlers(): void {
  hookEventHandlers.clear()
}

function emitHookEvent(event: HookExecutionEvent): void {
  for (const handler of hookEventHandlers) {
    handler(event)
  }
}
