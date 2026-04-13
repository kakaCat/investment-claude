Gateway runner (src/gateway/runner.ts). Loads config, initializes ChannelManager and SessionManager, wires onMessage/onCardAction callbacks, and keeps the process alive until SIGINT/SIGTERM. Leaf.
