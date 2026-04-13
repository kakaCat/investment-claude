import type { ChannelCardContext, ChannelOutboundContext } from '../../channel/types.js'

type FeishuMessageApi = {
  create(params: any): Promise<unknown>
  reply?(params: any): Promise<unknown>
}

function getMessageApi(client: unknown): FeishuMessageApi {
  const messageApi =
    (client as any)?.im?.v1?.message ??
    (client as any)?.im?.message

  if (!messageApi?.create) throw new Error('Feishu message API is unavailable')
  return messageApi as FeishuMessageApi
}

export async function sendFeishuText(client: unknown, ctx: ChannelOutboundContext): Promise<void> {
  const messageApi = getMessageApi(client)
  const content = JSON.stringify({ text: ctx.text })

  if (ctx.replyToId && typeof messageApi.reply === 'function') {
    await messageApi.reply({
      path: {
        message_id: ctx.replyToId,
      },
      data: {
        content,
        msg_type: 'text',
      },
    })
    return
  }

  await messageApi.create({
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: ctx.chatId,
      msg_type: 'text',
      content,
    },
  })
}

export async function sendFeishuCard(client: unknown, ctx: ChannelCardContext): Promise<void> {
  const messageApi = getMessageApi(client)

  await messageApi.create({
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: ctx.chatId,
      msg_type: 'interactive',
      content: JSON.stringify(ctx.card),
    },
  })
}
