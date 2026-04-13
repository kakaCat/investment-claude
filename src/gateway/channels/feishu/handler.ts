import * as lark from '@larksuite/oapi-sdk-nodejs'

import type { ChannelGatewayContext, InboundMessage } from '../../channel/types.js'
import type { FeishuClients } from './client.js'
import { extractTextFromMessage } from './client.js'

function toInboundMessage(payload: any): InboundMessage | null {
  const message = payload?.message
  if (!message?.message_id || !message?.chat_id) return null

  return {
    chatId: message.chat_id,
    senderId:
      payload?.sender?.sender_id?.open_id ??
      payload?.sender?.sender_id?.user_id ??
      payload?.sender?.sender_id?.union_id ??
      '',
    text: extractTextFromMessage(message),
    messageId: message.message_id,
    threadId: message.thread_id ?? message.root_id,
  }
}

export async function startFeishuHandler(
  clients: FeishuClients,
  ctx: ChannelGatewayContext,
): Promise<() => void> {
  const dispatcher = new lark.EventDispatcher({})

  dispatcher.register({
    'im.message.receive_v1': (payload: any) => {
      const message = toInboundMessage(payload)
      if (!message) return
      ctx.onMessage(message)
    },
  })

  const disconnect = () => {
    clients.wsClient.close({ force: true })
  }

  if (ctx.signal.aborted) {
    disconnect()
    return () => {}
  }

  ctx.signal.addEventListener('abort', disconnect, { once: true })
  await clients.wsClient.start({ eventDispatcher: dispatcher })

  return () => {
    ctx.signal.removeEventListener('abort', disconnect)
    disconnect()
  }
}
