export type GatewayConfig = {
  channels: {
    feishu?: {
      accounts: Record<string, FeishuAccountConfig>
    }
  }
}

export type FeishuAccountConfig = {
  appId: string
  appSecret: string
  allowFrom?: string[]
}

export type ChannelAccount = {
  id: string
  channelId: string
  [key: string]: unknown
}

export type InboundMessage = {
  chatId: string
  senderId: string
  text: string
  messageId: string
  threadId?: string
}

export type ChannelGatewayContext = {
  account: ChannelAccount
  onMessage: (msg: InboundMessage) => void
  onCardAction: (chatId: string, answer: Record<string, string>) => void
  signal: AbortSignal
}

export type ChannelOutboundContext = {
  account: ChannelAccount
  chatId: string
  text: string
  replyToId?: string
  threadId?: string
}

export type ChannelCardContext = {
  account: ChannelAccount
  chatId: string
  card: unknown
}

export type ChannelPlugin = {
  id: string
  meta: {
    label: string
    description: string
  }
  config: {
    resolveAccounts(cfg: GatewayConfig): ChannelAccount[]
  }
  gateway: {
    startAccount(ctx: ChannelGatewayContext): Promise<() => void>
  }
  outbound: {
    sendText(ctx: ChannelOutboundContext): Promise<void>
    sendCard(ctx: ChannelCardContext): Promise<void>
    sendTyping?(chatId: string, accountId: string): Promise<void>
  }
}
