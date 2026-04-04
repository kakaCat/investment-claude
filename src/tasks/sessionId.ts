import { randomUUID } from 'crypto'

let _sessionId: string | undefined

export function getSessionId(): string {
  if (!_sessionId) _sessionId = randomUUID()
  return _sessionId
}
