import type { ChannelPlugin, GatewayConfig, ChannelAccount } from '../../channel/types.js'
import { channelRegistry } from '../../channel/registry.js'
import { createFeishuClients, type FeishuClients } from './client.js'
import { startFeishuHandler } from './handler.js'
import { sendFeishuText, sendFeishuCard } from './sender.js'

// 缓存每个 accountId 对应的 client，复用 token
const clientCache = new Map<string, FeishuClients>()

export const feishuPlugin: ChannelPlugin = {
  id: 'feishu',
  meta: {
    label: '飞书',
    description: '飞书机器人渠道（WebSocket 长连接）',
  },
  config: {
    resolveAccounts(cfg: GatewayConfig): ChannelAccount[] {
      const accounts = cfg.channels?.feishu?.accounts ?? {}
      return Object.entries(accounts).map(([id, acct]) => ({
        id,
        channelId: 'feishu',
        appId: acct.appId,
        appSecret: acct.appSecret,
        allowFrom: acct.allowFrom ?? [],
      }))
    },
  },
  gateway: {
    async startAccount(ctx) {
      const { appId, appSecret, allowFrom } = ctx.account as any
      const clients = createFeishuClients(appId as string, appSecret as string)
      clientCache.set(ctx.account.id, clients)
      const filteredCtx = {
        ...ctx,
        onMessage: (msg: any) => {
          const allowed = (allowFrom as string[]) ?? []
          if (allowed.length > 0 && !allowed.includes(msg.senderId) && !allowed.includes(msg.chatId)) return
          ctx.onMessage(msg)
        },
      }
      return startFeishuHandler(clients, filteredCtx)
    },
  },
  outbound: {
    async sendText(ctx) {
      const cached = clientCache.get(ctx.account.id)
      const { client } = cached ?? createFeishuClients((ctx.account as any).appId, (ctx.account as any).appSecret)
      await sendFeishuText(client, ctx)
    },
    async sendCard(ctx) {
      const cached = clientCache.get(ctx.account.id)
      const { client } = cached ?? createFeishuClients((ctx.account as any).appId, (ctx.account as any).appSecret)
      await sendFeishuCard(client, ctx)
    },
  },
}

channelRegistry.register(feishuPlugin)
