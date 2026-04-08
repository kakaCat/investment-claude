import type {
  ChannelAccount,
  ChannelCardContext,
  ChannelGatewayContext,
  ChannelOutboundContext,
  ChannelPlugin,
  FeishuAccountConfig,
  GatewayConfig,
  InboundMessage,
} from './types.js'

const feishuAccount: FeishuAccountConfig = {
  appId: 'cli_app_id',
  appSecret: 'cli_app_secret',
  allowFrom: ['ou_xxx'],
}

const gatewayConfig: GatewayConfig = {
  channels: {
    feishu: {
      accounts: {
        default: feishuAccount,
      },
    },
  },
}

const account: ChannelAccount = {
  id: 'default',
  channelId: 'feishu',
  appId: 'cli_app_id',
}

const inboundMessage: InboundMessage = {
  chatId: 'oc_xxx',
  senderId: 'ou_xxx',
  text: 'hello',
  messageId: 'om_xxx',
  threadId: 'ot_xxx',
}

const gatewayContext: ChannelGatewayContext = {
  account,
  onMessage: (msg) => {
    void msg
  },
  onCardAction: (chatId, answer) => {
    void chatId
    void answer
  },
  signal: new AbortController().signal,
}

const outboundContext: ChannelOutboundContext = {
  account,
  chatId: 'oc_xxx',
  text: 'hello',
  replyToId: 'om_xxx',
  threadId: 'ot_xxx',
}

const cardContext: ChannelCardContext = {
  account,
  chatId: 'oc_xxx',
  card: { type: 'template' },
}

const plugin: ChannelPlugin = {
  id: 'feishu',
  meta: {
    label: 'Feishu',
    description: 'Feishu gateway plugin',
  },
  config: {
    resolveAccounts: (cfg) => {
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
    sendTyping: async (chatId, accountId) => {
      void chatId
      void accountId
    },
  },
}

void gatewayConfig
void inboundMessage
void gatewayContext
void outboundContext
void cardContext
void plugin
