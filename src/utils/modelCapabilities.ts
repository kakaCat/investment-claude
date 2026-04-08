/**
 * 判断模型是否支持 vision（image block in tool_result）。
 * claude-3+ 及 claude-opus/sonnet/haiku 系列均支持。
 */
export function modelSupportsVision(model: string): boolean {
  return /^claude-(3|opus|sonnet|haiku)/.test(model)
}
