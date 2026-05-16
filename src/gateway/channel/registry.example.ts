import { channelRegistry } from './registry.js'
import type { ChannelPlugin, GatewayConfig } from './types.js'

const account = {
  id: 'default',
  channelId: 'demo',
}

const plugin: ChannelPlugin = {
  id: 'demo',
  meta: {
    label: 'Demo',
    description: 'Demo channel plugin',
  },
  config: {
    resolveAccounts: (cfg: GatewayConfig) => {
      void cfg
      return [account]
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      void ctx
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

const selected: ChannelPlugin | undefined = channelRegistry.get('demo')
const plugins: ChannelPlugin[] = channelRegistry.getAll()

void selected
void plugins
