import { ChannelManager, type ChannelManagerCallbacks } from './manager.js'
import { channelRegistry } from './registry.js'
import type { ChannelPlugin, GatewayConfig, InboundMessage } from './types.js'

const inboundMessage: InboundMessage = {
  chatId: 'chat-1',
  senderId: 'user-1',
  text: 'hello',
  messageId: 'msg-1',
}

const callbacks: ChannelManagerCallbacks = {
  onMessage: (channelId, accountId, msg) => {
    void channelId
    void accountId
    void msg
  },
  onCardAction: (channelId, accountId, chatId, answer) => {
    void channelId
    void accountId
    void chatId
    void answer
  },
}

const plugin: ChannelPlugin = {
  id: 'manager-demo',
  meta: {
    label: 'Manager demo',
    description: 'Manager demo plugin',
  },
  config: {
    resolveAccounts: (cfg: GatewayConfig) => {
      void cfg
      return [
        {
          id: 'account-1',
          channelId: 'manager-demo',
        },
      ]
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      ctx.onMessage(inboundMessage)
      ctx.onCardAction('chat-1', { approved: 'yes' })
      return () => {}
    },
  },
  outbound: {
    sendText: async (ctx) => {
      void ctx
    },
    sendCard: async (ctx) => {
      void ctx
    },
  },
}

channelRegistry.register(plugin)

const manager = new ChannelManager()
const cfg: GatewayConfig = { channels: {} }

void manager.start(cfg, callbacks, new AbortController().signal)
void manager.stop()
