import type { ChannelPlugin, GatewayConfig, InboundMessage } from './types.js'
import { channelRegistry } from './registry.js'

export type ChannelManagerCallbacks = {
  onMessage: (channelId: string, accountId: string, msg: InboundMessage) => void
  onCardAction: (channelId: string, accountId: string, chatId: string, answer: Record<string, string>) => void
}

export class ChannelManager {
  private disconnects: Array<() => void> = []

  async start(cfg: GatewayConfig, callbacks: ChannelManagerCallbacks, signal: AbortSignal): Promise<void> {
    for (const plugin of channelRegistry.getAll()) {
      const accounts = plugin.config.resolveAccounts(cfg)
      for (const account of accounts) {
        const disconnect = await plugin.gateway.startAccount({
          account,
          signal,
          onMessage: (msg) => callbacks.onMessage(plugin.id, account.id, msg),
          onCardAction: (chatId, answer) => callbacks.onCardAction(plugin.id, account.id, chatId, answer),
        })
        this.disconnects.push(disconnect)
      }
    }
  }

  async stop(): Promise<void> {
    for (const disconnect of this.disconnects) disconnect()
    this.disconnects = []
  }
}
