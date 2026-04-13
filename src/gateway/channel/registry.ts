import type { ChannelPlugin } from './types.js'

class ChannelRegistry {
  private plugins = new Map<string, ChannelPlugin>()

  register(plugin: ChannelPlugin): void {
    this.plugins.set(plugin.id, plugin)
  }

  get(id: string): ChannelPlugin | undefined {
    return this.plugins.get(id)
  }

  getAll(): ChannelPlugin[] {
    return [...this.plugins.values()]
  }
}

export const channelRegistry = new ChannelRegistry()
