// 系统提示词 — 对标 Claude Code src/constants/prompts.ts
// 当前阶段：简单占位，后续会扩展

export function getSystemPrompt(): string {
  return `You are Pi, an AI coding assistant running in the terminal.
You help users with software engineering tasks.
When you need to run commands or read files, use the available tools.`
}
