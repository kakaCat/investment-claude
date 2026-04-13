import * as lark from '@larksuite/oapi-sdk-nodejs'

export type FeishuClients = {
  client: lark.Client
  wsClient: lark.WSClient
}

export function createFeishuClients(appId: string, appSecret: string): FeishuClients {
  const client = new lark.Client({ appId, appSecret, appType: lark.AppType.SelfBuild })
  const wsClient = new lark.WSClient({ appId, appSecret })
  return { client, wsClient }
}

export function extractTextFromMessage(message: any): string {
  try {
    const content = JSON.parse(message.content ?? '{}')
    if (message.message_type === 'text') return content.text ?? ''
    return ''
  } catch {
    return ''
  }
}
