import { query } from '../query.js'
import { getActiveTools, getAllTools } from '../tools/index.js'
import type { QuerySession } from './sessionManager.js'

export type GatewayInteractionHandlers = {
  onChunk: (text: string) => Promise<void>
  askUser: (
    question: string,
    options: ReadonlyArray<{ label: string; description?: string }>,
  ) => Promise<string>
  enterPlanMode: () => Promise<void>
  exitPlanMode: (plan: string) => Promise<string>
  verifyExecution: (summary: string) => Promise<string>
}

export async function runQuery(
  session: QuerySession,
  userText: string,
  handlers: GatewayInteractionHandlers,
  systemPrompt: string,
): Promise<void> {
  session.messages.push({
    type: 'user',
    content: [{ type: 'text', text: userText }],
  })
  session.processing = true

  const tools = getActiveTools()
  const allTools = getAllTools()

  try {
    const stream = query({
      messages: session.messages,
      tools,
      allTools,
      systemPrompt,
      maxTurns: 10,
      abortSignal: session.abortController.signal,
      canUseTool: async () => 'allow',
      askUser: handlers.askUser,
      enterPlanMode: handlers.enterPlanMode,
      exitPlanMode: handlers.exitPlanMode,
      verifyExecution: handlers.verifyExecution,
      sessionId: `${session.channelId}:${session.chatId}`,
    })

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        await handlers.onChunk(event.delta)
      }

      if (event.type === 'messages_snapshot') {
        session.messages = event.messages
      }

      if (event.type === 'error') {
        throw event.error
      }
    }
  } finally {
    session.processing = false
    session.lastActiveAt = Date.now()
  }
}
