import { buildTool } from '../../Tool.js'
import { markSnipped } from '../../utils/snipStore.js'
import { resolveShortId } from '../../utils/messageIds.js'

export const SnipTool = buildTool({
  name: 'snip',
  description:
    'Remove messages from the conversation context that are no longer needed. ' +
    'Use the [id:xxx] tags visible in the conversation to identify messages. ' +
    'Snipped messages are hidden from future context but the conversation continues normally.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short message IDs to remove (the xxx part from [id:xxx] tags)',
      },
    },
    required: ['message_ids'],
  },
  isEnabled: () => true,
  isReadOnly: () => true,
  call: async (input: unknown) => {
    const { message_ids } = input as { message_ids: string[] }
    const resolved: string[] = []
    const unresolved: string[] = []

    for (const shortId of message_ids) {
      const uuid = resolveShortId(shortId)
      if (uuid) {
        resolved.push(uuid)
      } else {
        unresolved.push(shortId)
      }
    }

    if (resolved.length > 0) {
      markSnipped(resolved)
    }

    const parts: string[] = []
    if (resolved.length > 0) parts.push(`Snipped ${resolved.length} message(s)`)
    if (unresolved.length > 0) parts.push(`Unknown IDs: ${unresolved.join(', ')}`)
    return parts.join('. ') || 'No messages snipped'
  },
})
